import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { readFileSync } from 'fs';

export default {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('View server dashboard with stats and activity')
    .setDefaultMemberPermissions(0),

  async execute(interaction, api) {
    await interaction.deferReply();

    try {
      // Get server stats
      const guild = interaction.guild;
      let transactionStats = { total: 0, today: 0, thisWeek: 0 };

      try {
        const history = JSON.parse(readFileSync('./replaceHistory.json', 'utf-8'));
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        transactionStats.total = history.length;
        transactionStats.today = history.filter((h) => new Date(h.timestamp) > todayStart).length;
        transactionStats.thisWeek = history.filter((h) => new Date(h.timestamp) > weekStart).length;
      } catch (e) {
        // No history yet
      }

      const embed1 = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📊 Server Dashboard')
        .setDescription(`Dashboard for **${guild.name}**`)
        .addFields(
          {
            name: '👥 Server Info',
            value: `Members: **${guild.memberCount}**\nChannels: **${guild.channels.cache.size}**\nRoles: **${guild.roles.cache.size}**`,
            inline: true
          },
          {
            name: '📈 Transactions',
            value: `Total: **${transactionStats.total}**\nToday: **${transactionStats.today}**\nThis Week: **${transactionStats.thisWeek}**`,
            inline: true
          },
          {
            name: '🤖 Bot Status',
            value: `Status: ✅ **Online**\nUptime: **${Math.floor(interaction.client.uptime / 1000 / 60)}** min\nPing: **${interaction.client.ws.ping}** ms`,
            inline: false
          },
          {
            name: '📋 Quick Commands',
            value: '`/stock` • `/replace` • `/sync-variants` • `/invoice-view` • `/backup` • `/audit`',
            inline: false
          }
        )
        .setFooter({
          text: 'SellAuth Bot Dashboard',
          iconURL: guild.iconURL()
        })
        .setTimestamp();

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('dashboard_stats')
          .setLabel('📊 Detailed Stats')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('dashboard_commands')
          .setLabel('📝 All Commands')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('dashboard_help')
          .setLabel('❓ Help')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [embed1], components: [buttons] });
    } catch (error) {
      console.error('[DASHBOARD] Error:', error.message);
      await interaction.editReply({
        content: `❌ Dashboard error: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
