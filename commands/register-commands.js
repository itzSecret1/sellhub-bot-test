import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { config } from '../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  data: new SlashCommandBuilder()
    .setName('register-commands')
    .setDescription('Register all slash commands to Discord (Admin only)'),

  requiredRole: 'admin',
  onlyWhitelisted: true,

  async execute(interaction, api) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Load all commands
      const commands = [];
      const commandFiles = readdirSync(join(__dirname, '..', 'commands'))
        .filter((file) => file.endsWith('.js') && !file.endsWith('.map') && file !== 'register-commands.js');

      for (const file of commandFiles) {
        try {
          const commandPath = pathToFileURL(join(__dirname, '..', 'commands', `${file}`)).href;
          const command = await import(commandPath);
          if (command.default && command.default.data) {
            commands.push(command.default.data.toJSON());
          }
        } catch (err) {
          console.error(`Error loading ${file}:`, err.message);
        }
      }

      if (commands.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('❌ Error')
              .setDescription('No commands found to register!')
          ]
        });
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('⏳ Registering Commands...')
            .setDescription(`Loading ${commands.length} commands...`)
        ]
      });

      // Get client ID
      const clientId = interaction.client.user.id;
      const guildId = config.BOT_GUILD_ID;

      // Create REST client
      const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);

      // Register commands
      try {
        const data = await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commands }
        );

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Commands Registered!')
          .setDescription(`Successfully registered ${data.length} commands`)
          .addFields(
            { name: '📝 Commands', value: data.slice(0, 20).map(c => `\`/${c.name}\``).join(', ') + (data.length > 20 ? `\n... and ${data.length - 20} more` : ''), inline: false }
          )
          .setFooter({ text: 'Commands should appear in Discord within a few minutes' });

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        let errorMsg = 'Unknown error';
        
        if (error.code === 50001) {
          errorMsg = 'Missing Access - Bot needs "applications.commands" scope';
        } else if (error.code === 50025) {
          errorMsg = 'Invalid Form Body - Check command structure';
        } else if (error.code === 10004) {
          errorMsg = 'Unknown Guild - Check BOT_GUILD_ID';
        } else if (error.code === 30034) {
          errorMsg = 'Rate Limit - Too many commands registered recently. Wait a few hours.';
        } else {
          errorMsg = `${error.message} (Code: ${error.code || 'N/A'})`;
        }

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('❌ Registration Failed')
              .setDescription(errorMsg)
          ]
        });
      }
    } catch (error) {
      console.error('[REGISTER-COMMANDS] Error:', error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Error')
            .setDescription(`Failed to register commands: ${error.message}`)
        ]
      });
    }
  }
};

