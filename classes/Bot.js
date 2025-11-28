import { Collection, Events, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { checkUserIdWhitelist } from '../utils/checkUserIdWhitelist.js';
import { config } from '../utils/config.js';
import { NotWhitelistedException } from '../utils/NotWhitelistedException.js';
import { startAutoSync } from '../utils/autoSync.js';
import { sessionManager } from '../utils/SessionRecoveryManager.js';
import { connectionManager } from '../utils/ConnectionManager.js';
import { createStatusReporter } from '../utils/StatusReporter.js';
import { createWeeklyReporter } from '../utils/WeeklyReporter.js';
import { createDailyBackupReporter } from '../utils/DailyBackupReporter.js';
import { createAutoModerator } from '../utils/AutoModerator.js';
import { createAutoSyncScheduler } from '../utils/AutoSyncScheduler.js';
import { createPredictiveAlerts } from '../utils/PredictiveAlerts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Bot {
  constructor(client, api) {
    this.client = client;
    this.api = api;

    this.prefix = '/';
    this.commands = new Collection();
    this.slashCommands = [];
    this.slashCommandsMap = new Collection();
    this.cooldowns = new Collection();
    this.queues = new Collection();
    this.isRegisteringCommands = false;

    // Create status reporter for staff notifications
    this.statusReporter = createStatusReporter(client);
    sessionManager.statusReporter = this.statusReporter;

    // Create automated reporters and systems
    this.weeklyReporter = createWeeklyReporter(client, api);
    this.dailyBackupReporter = createDailyBackupReporter(client);
    this.autoModerator = createAutoModerator(client);
    this.autoSyncScheduler = createAutoSyncScheduler(client, api);
    this.predictiveAlerts = createPredictiveAlerts(client);

    // Login with retry logic for Discord rate limits
    this.loginWithRetry();

    this.client.on('ready', () => {
      console.log(`${this.client.user.username} ready!`);
      if (!this.isRegisteringCommands) {
        this.registerSlashCommands();
      }

      // Initialize all automated systems
      this.initializeAutomatedSystems();
    });

    this.client.on('warn', (info) => console.log(info));
    this.client.on('error', (error) => {
      console.error('[BOT ERROR]', error.message);
    });

    this.onInteractionCreate();

    // Global error handler to prevent bot crash
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[BOT] Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('[BOT] Uncaught Exception:', error);
    });
  }

  async loginWithRetry() {
    // Check if we can safely attempt connection
    if (!connectionManager.canAttemptConnection()) {
      const waitTime = connectionManager.getSafeWaitTime();
      const waitSeconds = Math.ceil(waitTime / 1000);
      console.log(`[BOT LOGIN] ⏳ Safe wait: ${waitSeconds}s before retry\n`);
      setTimeout(() => this.loginWithRetry(), waitTime);
      return;
    }

    try {
      connectionManager.recordAttempt();
      console.log(`[BOT LOGIN] Connecting to Discord... (Safe attempt)`);
      await this.client.login(config.BOT_TOKEN);

      // Success
      connectionManager.markSuccess();
      sessionManager.markSuccessfulLogin();
    } catch (error) {
      if (error.message && error.message.includes('Not enough sessions')) {
        // Handle Discord session limit with enhanced recovery
        connectionManager.markFailure(true);
        await sessionManager.handleSessionLimit(error, () => this.loginWithRetry());
      } else {
        // Handle other errors with safer backoff
        connectionManager.markFailure(false);
        console.error(`\n❌ [BOT LOGIN ERROR] ${error.message}`);

        const waitTime = connectionManager.getSafeWaitTime(30 * 1000);
        const waitSeconds = Math.ceil(waitTime / 1000);
        console.log(`[BOT LOGIN] Retrying in ${waitSeconds} seconds...\n`);
        setTimeout(() => this.loginWithRetry(), waitTime);
      }
    }
  }

  async registerSlashCommands() {
    if (this.isRegisteringCommands) return;
    this.isRegisteringCommands = true;

    try {
      this.slashCommands = [];
      this.slashCommandsMap.clear();

      const commandFiles = readdirSync(join(__dirname, '..', 'commands'))
        .filter((file) => file.endsWith('.js') && !file.endsWith('.map'));

      // Load all commands
      for (const file of commandFiles) {
        try {
          const commandPath = pathToFileURL(join(__dirname, '..', 'commands', `${file}`)).href;
          const command = await import(commandPath);

          if (command.default && command.default.data) {
            const cmdName = command.default.data.name;
            if (!this.slashCommandsMap.has(cmdName)) {
              this.slashCommands.push(command.default.data.toJSON());
              this.slashCommandsMap.set(cmdName, command.default);
            }
          }
        } catch (err) {
          console.error(`[BOT] Error loading ${file}:`, err.message);
        }
      }

      console.log(`[BOT] ✅ Loaded ${this.slashCommands.length} commands into memory`);
      
      // Fire registration in background - NO BLOCKING
      this.fireAndForgetRegistration();
      
    } catch (error) {
      console.error('[BOT] Error loading commands:', error.message);
    } finally {
      this.isRegisteringCommands = false;
    }
  }

  async fireAndForgetRegistration() {
    try {
      console.log('[BOT] 🚀 Starting background command registration (fire-and-forget)...');
      const rest = new REST({ version: '9' }).setToken(config.BOT_TOKEN);
      const route = config.BOT_GUILD_ID
        ? Routes.applicationGuildCommands(this.client.user.id, config.BOT_GUILD_ID)
        : Routes.applicationCommands(this.client.user.id);

      // Clear existing
      try {
        const existing = await rest.get(route);
        for (const cmd of existing) {
          await rest.delete(`${route}/${cmd.id}`).catch(() => {});
        }
      } catch (e) {
        // Ignore errors
      }

      // Wait for Discord
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Send without awaiting fully - just fire it
      const putPromise = rest.put(route, { body: this.slashCommands });

      // Set aggressive timeout - if not done in 10s, just give up
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => {
          console.log('[BOT] ⏱️  Registration took >10s, continuing anyway...');
          resolve('timeout');
        }, 10000)
      );

      const result = await Promise.race([putPromise, timeoutPromise]);
      
      if (result === 'timeout') {
        console.log(`[BOT] ⚠️  Registration incomplete but bot is fully functional with ${this.slashCommands.length} commands in memory`);
      } else if (Array.isArray(result)) {
        console.log(`[BOT] ✅ Registered ${result.length} commands`);
      }
    } catch (error) {
      console.warn(`[BOT] Registration error (non-fatal):`, error.message);
    }
  }

  /**
   * Initialize all automated systems
   */
  async initializeAutomatedSystems() {
    try {
      await this.statusReporter.sendDailyStatusUpdate();
      this.scheduleSystemUpdates();
      this.weeklyReporter.scheduleWeeklyReports();
      this.dailyBackupReporter.scheduleDailyBackups();
      this.autoSyncScheduler.startHourlySync();
      this.autoModerator.setup();
      this.predictiveAlerts.scheduleAlertChecks();
      console.log('[BOT] ✅ All automated systems initialized');
    } catch (error) {
      console.error('[BOT] Error initializing systems:', error.message);
    }
  }

  /**
   * Schedule system updates
   */
  scheduleSystemUpdates() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(12, 0, 0, 0);

    const timeUntilNext = tomorrow - now;

    console.log(`[BOT] ✅ System scheduled: Daily updates at 12:00 UTC, Weekly reports at 09:00 UTC Mondays, Daily backups at 03:00 UTC`);

    setTimeout(
      () => {
        this.statusReporter.sendDailyStatusUpdate();
        setInterval(() => this.statusReporter.sendDailyStatusUpdate(), 24 * 60 * 60 * 1000);
      },
      timeUntilNext
    );
  }

  async onInteractionCreate() {
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isAutocomplete()) {
        const command = this.slashCommandsMap.get(interaction.commandName);
        if (!command || !command.autocomplete) return;

        try {
          await command.autocomplete(interaction, this.api);
        } catch (error) {
          console.error('Autocomplete error:', error);
        }
        return;
      }

      if (!interaction.isChatInputCommand()) return;

      const command = this.slashCommandsMap.get(interaction.commandName);
      if (!command) return;

      if (!this.cooldowns.has(interaction.commandName)) {
        this.cooldowns.set(interaction.commandName, new Collection());
      }

      const now = Date.now();
      const timestamps = this.cooldowns.get(interaction.commandName);
      const cooldownAmount = (command.cooldown || 1) * 1000;
      const timestamp = timestamps.get(interaction.user.id);

      if (timestamp) {
        const expirationTime = timestamp + cooldownAmount;
        if (now < expirationTime) {
          const timeLeft = (expirationTime - now) / 1000;
          return interaction.reply({
            content: `You need to wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${interaction.commandName}\` command.`,
            ephemeral: true
          });
        }
      }

      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

      try {
        if (await checkUserIdWhitelist(command, interaction, config)) {
          await command.execute(interaction, this.api);
        } else {
          throw new NotWhitelistedException();
        }
      } catch (error) {
        console.error(error);
        if (error.message.includes('permission')) {
          interaction.reply({ content: error.toString(), ephemeral: true }).catch(console.error);
        } else {
          interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true }).catch(console.error);
        }
      }
    });
  }
}
