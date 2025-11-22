import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { bot } from '../index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List of available commands organized by role'),
  
  onlyWhitelisted: true,
  requiredRole: 'staff',
  allowStaffOnly: true,
  
  async execute(interaction) {
    let commands = bot.slashCommandsMap;

    // Separate commands by role
    const staffCommands = [];
    const adminCommands = [];

    commands.forEach((cmd) => {
      if (cmd.requiredRole === 'admin') {
        adminCommands.push(cmd);
      } else if (cmd.requiredRole === 'staff') {
        staffCommands.push(cmd);
      }
    });

    // Create embeds
    const embeds = [];

    // Admin Commands Embed
    if (adminCommands.length > 0) {
      let adminEmbed = new EmbedBuilder()
        .setTitle('👑 OWNER COMMANDS (Admin)')
        .setDescription('Commands only accessible to owners')
        .setColor('#FF0000');

      adminCommands.forEach((cmd) => {
        adminEmbed.addFields({
          name: `**/${cmd.data.name}**`,
          value: `${cmd.data.description}`,
          inline: false
        });
      });

      adminEmbed.setTimestamp();
      embeds.push(adminEmbed);
    }

    // Staff Commands Embed
    if (staffCommands.length > 0) {
      let staffEmbed = new EmbedBuilder()
        .setTitle('👔 STAFF COMMANDS')
        .setDescription('Commands accessible to staff and above')
        .setColor('#6571ff');

      staffCommands.forEach((cmd) => {
        staffEmbed.addFields({
          name: `**/${cmd.data.name}**`,
          value: `${cmd.data.description}`,
          inline: false
        });
      });

      staffEmbed.setTimestamp();
      embeds.push(staffEmbed);
    }

    // Summary Embed
    const summaryEmbed = new EmbedBuilder()
      .setTitle('📋 COMMAND SUMMARY')
      .setColor('#00FF00')
      .addFields(
        {
          name: '👑 Owner Commands',
          value: `Total: **${adminCommands.length}**`,
          inline: true
        },
        {
          name: '👔 Staff Commands',
          value: `Total: **${staffCommands.length}**`,
          inline: true
        }
      )
      .setTimestamp();

    embeds.push(summaryEmbed);

    return interaction.reply({ embeds: embeds }).catch(console.error);
  }
};
