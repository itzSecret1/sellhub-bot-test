import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CommandLogger } from '../utils/commandLogger.js';

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('Show all available commands and their usage'),

  async execute(interaction) {
    try {
      await CommandLogger.logCommand(interaction, 'help');
      const embeds = [
        new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('📚 SellAuth Bot - Guía Completa')
          .setDescription('Todos los comandos disponibles y cómo usarlos')
          .setThumbnail('https://cdn-icons-png.flaticon.com/512/2921/2921222.png'),

        new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle('📊 /stock')
          .setDescription('Ver productos y verificar stock disponible')
          .addFields(
            {
              name: 'Uso',
              value: '`/stock` o `/stock product:nombre` o `/stock product:nombre variant:tipo`',
              inline: false
            },
            {
              name: 'Ejemplos',
              value:
                '• `/stock` → Lista todos los productos\n' +
                '• `/stock product:Fortnite` → Muestra variantes de Fortnite\n' +
                '• `/stock product:Fortnite variant:100-200` → Muestra items reales',
              inline: false
            },
            { name: '👤 Role Requerido', value: 'Staff+', inline: true },
            { name: '⏱️ Velocidad', value: '<100ms', inline: true }
          ),

        new EmbedBuilder()
          .setColor(0xff9900)
          .setTitle('🛍️ /replace')
          .setDescription('Extraer items del stock y entregarlos')
          .addFields(
            {
              name: 'Parámetros',
              value:
                '• **product** (requerido): Seleccionar producto\n' +
                '• **quantity** (requerido): Cantidad de items (mínimo 1)\n' +
                '• **variant** (requerido): Seleccionar variante\n' +
                '• **visibility** (opcional): private (defecto) o public',
              inline: false
            },
            {
              name: 'Ejemplo',
              value: '`/replace product:Fortnite quantity:5 variant:100-200 visibility:private`',
              inline: false
            },
            { name: '👤 Role Requerido', value: 'Staff+', inline: true },
            { name: '⏱️ Velocidad', value: '1-2s', inline: true },
            {
              name: '✅ Qué Hace',
              value:
                '1. Valida producto y variante\n' +
                '2. Extrae items del stock\n' +
                '3. Actualiza API SellAuth\n' +
                '4. Guarda caché local\n' +
                '5. Registra en historial\n' +
                '6. Entrega items por Discord',
              inline: false
            }
          ),

        new EmbedBuilder()
          .setColor(0x9900ff)
          .setTitle('↩️ /unreplace')
          .setDescription('Restaurar última/s extracción/ones')
          .addFields(
            {
              name: 'Parámetro',
              value: '• **count** (opcional): Cuántas extracciones deshacer (defecto: 1)',
              inline: false
            },
            {
              name: 'Ejemplos',
              value:
                '• `/unreplace` → Restaura última extracción\n' +
                '• `/unreplace count:3` → Restaura últimas 3 extracciones',
              inline: false
            },
            { name: '👤 Role Requerido', value: 'Staff+', inline: true },
            { name: '⏱️ Velocidad', value: '2-3s', inline: true }
          ),

        new EmbedBuilder()
          .setColor(0x00cccc)
          .setTitle('🔄 /sync-variants')
          .setDescription('Sincronizar todos los productos (solo Admins)')
          .addFields(
            {
              name: 'Uso',
              value: '`/sync-variants`',
              inline: false
            },
            {
              name: '📊 Qué Hace',
              value:
                '• Descarga todos los productos de SellAuth\n' +
                '• Descubre variantes de invoices\n' +
                '• Actualiza caché local\n' +
                '• Muestra barra de progreso',
              inline: false
            },
            { name: '👤 Role Requerido', value: 'Admin SOLO', inline: true },
            { name: '⏱️ Tiempo', value: '~18 segundos', inline: true },
            {
              name: '💡 Recomendación',
              value: 'Ejecutar diariamente para mantener stock actualizado',
              inline: false
            }
          ),

        new EmbedBuilder()
          .setColor(0xcc00ff)
          .setTitle('📋 /invoice-view')
          .setDescription('Ver detalles de un producto específico')
          .addFields(
            {
              name: 'Parámetro',
              value: '• **product_id** (requerido): ID del producto a ver',
              inline: false
            },
            {
              name: 'Ejemplo',
              value: '`/invoice-view product_id:386010`',
              inline: false
            },
            { name: '👤 Role Requerido', value: 'Staff+', inline: true },
            { name: '⏱️ Velocidad', value: '<100ms', inline: true }
          ),

        new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('📖 /help')
          .setDescription('Ver este mensaje de ayuda')
          .addFields(
            {
              name: 'Uso',
              value: '`/help`',
              inline: false
            },
            { name: '👤 Role Requerido', value: 'Todos', inline: true }
          ),

        new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle('🎯 Tips & Recomendaciones')
          .addFields(
            {
              name: '✅ Autocomplete',
              value: 'Todos los campos con autocomplete ayudan a seleccionar más rápido',
              inline: false
            },
            {
              name: '✅ Sincronización Diaria',
              value: 'Ejecuta `/sync-variants` cada día para mantener el stock actualizado',
              inline: false
            },
            {
              name: '✅ Historial',
              value: 'Usa `/unreplace` para deshacer extracciones si es necesario',
              inline: false
            },
            {
              name: '✅ Privacidad',
              value: 'Usa `visibility:private` para entregas confidenciales',
              inline: false
            },
            {
              name: '❓ Ayuda',
              value: 'Para problemas, contacta al admin del servidor',
              inline: false
            }
          )
          .setFooter({ text: 'SellAuth Bot v1.0 | Completamente Funcional' })
          .setTimestamp()
      ];

      await interaction.reply({ embeds, ephemeral: true });
    } catch (error) {
      console.error('[HELP] Error:', error);
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
