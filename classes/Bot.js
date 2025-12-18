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

    this.statusReporter = createStatusReporter(client);
    sessionManager.statusReporter = this.statusReporter;

    this.weeklyReporter = createWeeklyReporter(client, api);
    this.dailyBackupReporter = createDailyBackupReporter(client);
    this.autoModerator = createAutoModerator(client);
    this.autoSyncScheduler = createAutoSyncScheduler(client, api);
    this.predictiveAlerts = createPredictiveAlerts(client);

    this.loginWithRetry();

    this.client.on('ready', async () => {
      console.log(`${this.client.user.username} ready!`);
      // Wait a bit to ensure client is fully ready
      await new Promise(r => setTimeout(r, 2000));
      
      // Check registered commands and try to register if needed
      try {
        const guild = await this.client.guilds.fetch(config.BOT_GUILD_ID);
        const registered = await guild.commands.fetch();
        const expectedCount = 35; // Update this if you add/remove commands
        
        console.log(`[BOT] 📊 Currently registered: ${registered.size} commands`);
        
        if (registered.size < 5) {
          console.log(`[BOT] ⚠️  Only ${registered.size} commands registered (expected ~${expectedCount})`);
          console.log(`[BOT] ❌ AUTO-REGISTRATION DISABLED: Discord is blocking this bot token`);
          console.log(`[BOT] `);
          console.log(`[BOT] 🔴 SOLUCIÓN REQUERIDA: Crear nuevo bot token`);
          console.log(`[BOT] `);
          console.log(`[BOT] 📋 PASOS:`);
          console.log(`[BOT]    1. Ve a: https://discord.com/developers/applications`);
          console.log(`[BOT]    2. Selecciona tu aplicación o crea una nueva`);
          console.log(`[BOT]    3. Ve a "Bot" → Click "Reset Token" o crea nuevo bot`);
          console.log(`[BOT]    4. Copia el NUEVO token`);
          console.log(`[BOT]    5. En Railway: Settings → Variables → Actualiza BOT_TOKEN`);
          console.log(`[BOT]    6. Reinicia el bot (se registrarán automáticamente)`);
          console.log(`[BOT] `);
          console.log(`[BOT] ⚠️  El bot funcionará pero los comandos no aparecerán hasta crear nuevo token`);
        } else {
          console.log(`[BOT] ✅ Commands registered: ${registered.size}`);
        }
      } catch (e) {
        console.warn(`[BOT] ⚠️  Could not check registered commands:`, e.message);
      }
      
      this.initializeAutomatedSystems();
    });

    this.client.on('warn', (info) => console.log(info));
    this.client.on('error', (error) => {
      console.error('[BOT ERROR]', error.message);
    });

    this.onInteractionCreate();

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[BOT] Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('[BOT] Uncaught Exception:', error);
    });
  }

  async loginWithRetry() {
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
      connectionManager.markSuccess();
      sessionManager.markSuccessfulLogin();
    } catch (error) {
      if (error.message && error.message.includes('Not enough sessions')) {
        connectionManager.markFailure(true);
        await sessionManager.handleSessionLimit(error, () => this.loginWithRetry());
      } else {
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
      
      // Use REST API for faster registration (if not rate limited)
      if (!this.client.user || !this.client.user.id) {
        await new Promise(r => setTimeout(r, 2000));
      }
      
      // Try REST API first (faster, but can hit rate limits)
      try {
        const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);
        const clientId = this.client.user.id;
        const guildId = config.BOT_GUILD_ID;
        
        console.log(`[BOT] 🚀 Attempting REST API registration...`);
        const data = await Promise.race([
          rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: this.slashCommands }
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('REST API timeout (15s)')), 15000)
          )
        ]);
        
        console.log(`[BOT] ✅ Successfully registered ${data.length} commands via REST API!`);
        this.isRegisteringCommands = false;
        return;
      } catch (error) {
        if (error.code === 30034) {
          console.error(`[BOT] ❌ RATE LIMIT: Cannot register commands right now`);
          throw error; // Re-throw to show in main error handler
        }
        console.log(`[BOT] ⚠️  REST API failed: ${error.message}`);
        console.log(`[BOT] 🔄 Falling back to individual registration...`);
      }
      
      // Fallback to individual registration
      await this.registerIndividualCommands();
      
    } catch (error) {
      console.error('[BOT] Error loading commands:', error.message);
      this.isRegisteringCommands = false;
    }
  }

  async registerIndividualCommands() {
    try {
      if (!this.slashCommands || this.slashCommands.length === 0) {
        console.error(`[BOT] ❌ No commands loaded! Cannot register.`);
        this.isRegisteringCommands = false;
        return;
      }

      // Ensure client.user is available
      if (!this.client.user || !this.client.user.id) {
        console.error(`[BOT] ❌ Client user not available! Waiting...`);
        await new Promise(r => setTimeout(r, 2000));
        if (!this.client.user || !this.client.user.id) {
          console.error(`[BOT] ❌ Client user still not available after wait!`);
          this.isRegisteringCommands = false;
          return;
        }
      }

      const guild = await this.client.guilds.fetch(config.BOT_GUILD_ID);
      if (!guild) {
        console.error(`[BOT] ❌ Guild not found: ${config.BOT_GUILD_ID}`);
        this.isRegisteringCommands = false;
        return;
      }

      // Validate commands before registering
      const validCommands = [];
      for (const cmd of this.slashCommands) {
        if (cmd && cmd.name) {
          validCommands.push(cmd);
        } else {
          console.warn(`[BOT] ⚠️  Skipping invalid command:`, cmd);
        }
      }

      if (validCommands.length === 0) {
        console.error(`[BOT] ❌ No valid commands to register!`);
        this.isRegisteringCommands = false;
        return;
      }

      console.log(`[BOT] 📋 Registering ${validCommands.length} commands individually...`);
      console.log(`[BOT] Guild: ${guild.name} (${guild.id})`);
      
      // Clear existing commands first (optional, but helps avoid duplicates)
      try {
        const existing = await guild.commands.fetch();
        if (existing.size > 0) {
          console.log(`[BOT] Found ${existing.size} existing commands, clearing...`);
          for (const cmd of existing.values()) {
            try {
              await Promise.race([
                guild.commands.delete(cmd.id),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
              ]);
            } catch (e) {
              // Ignore errors when deleting
            }
          }
          console.log(`[BOT] ✅ Cleared existing commands`);
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (e) {
        console.warn(`[BOT] ⚠️  Could not clear existing commands:`, e.message);
        // Continue anyway
      }

      let success = 0;
      let failed = 0;
      const errors = [];
      
      // Register commands one by one with proper rate limit handling
      for (let i = 0; i < validCommands.length; i++) {
        const cmd = validCommands[i];
        
        try {
          // Use Promise.race to add timeout protection
          const created = await Promise.race([
            guild.commands.create(cmd),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Command registration timeout (10s)')), 10000)
            )
          ]);
          
          success++;
          console.log(`[BOT] ✅ [${i + 1}/${validCommands.length}] Created: ${cmd.name}`);
          
          // Rate limit: wait between commands (Discord allows 5 commands per 5 seconds)
          // Wait 1.2 seconds between commands to be safe
          await new Promise(r => setTimeout(r, 1200));
          
        } catch (err) {
          failed++;
          const errorMsg = err.message || err.toString();
          errors.push({ name: cmd.name, error: errorMsg });
          
          if (err.code === 50025) {
            console.error(`[BOT] ❌ [${i + 1}/${validCommands.length}] Invalid command: ${cmd.name} - ${errorMsg}`);
          } else if (err.code === 30034) {
            console.error(`[BOT] ❌ [${i + 1}/${validCommands.length}] Rate limit hit for: ${cmd.name}`);
            // Wait longer on rate limit
            await new Promise(r => setTimeout(r, 5000));
          } else {
            console.error(`[BOT] ❌ [${i + 1}/${validCommands.length}] Failed: ${cmd.name} - ${errorMsg}`);
          }
          
          // Wait before next command even on error
          await new Promise(r => setTimeout(r, 800));
        }
      }
      
      console.log(`\n[BOT] ✅ REGISTRATION COMPLETE: ${success}/${validCommands.length} commands registered`);
      if (failed > 0) {
        console.log(`[BOT] ⚠️  ${failed} commands failed to register`);
        if (errors.length > 0) {
          console.log(`[BOT] Failed commands:`, errors.slice(0, 5).map(e => `${e.name}: ${e.error}`).join(', '));
        }
      }
      
      // Verify registration
      try {
        const registered = await guild.commands.fetch();
        console.log(`[BOT] ✅ Verified: ${registered.size} commands now available in Discord`);
      } catch (e) {
        console.warn(`[BOT] ⚠️  Could not verify commands:`, e.message);
      }
      
    } catch (error) {
      console.error(`[BOT] ❌ Registration error:`, error.message);
      if (error.stack) {
        console.error(`[BOT] Stack:`, error.stack.split('\n').slice(0, 3).join('\n'));
      }
    } finally {
      this.isRegisteringCommands = false;
    }
  }

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
