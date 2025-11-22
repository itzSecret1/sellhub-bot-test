import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { AdvancedCommandLogger } from '../utils/advancedCommandLogger.js';
import { quickReply } from '../utils/quickResponse.js';

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('Show all available commands and their usage'),

  async execute(interaction) {
    // Use quick reply to ensure response within 3 seconds
    await quickReply(interaction, async () => {
      const startTime = Date.now();
      try {
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
              { name: 'Uso', value: '`/stock` o `/stock product:nombre variant:tipo`', inline: false },
              { name: 'Ejemplos', value: '• `/stock` → Lista todos\n• `/stock product:Fortnite` → Variantes\n• `/stock product:Fortnite variant:100-200` → Items reales', inline: false },
              { name: '👤 Role Requerido', value: 'Staff+', inline: true },
              { name: '⏱️ Velocidad', value: '<100ms', inline: true }
            ),

          new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle('🛍️ /replace')
            .setDescription('Extraer items del stock y entregarlos')
            .addFields(
              { name: 'Parámetros', value: '• **product** (requerido)\n• **quantity** (requerido)\n• **variant** (requerido)\n• **visibility** (opcional: private/public)', inline: false },
              { name: 'Ejemplo', value: '`/replace product:Fortnite quantity:5 variant:100-200`', inline: false },
              { name: '👤 Role Requerido', value: 'Staff+', inline: true }
            ),

          new EmbedBuilder()
            .setColor(0x9900ff)
            .setTitle('↩️ /unreplace')
            .setDescription('Restaurar última/s extracción/ones')
            .addFields(
              { name: 'Parámetro', value: '• **count** (opcional): Cuántas deshacer (defecto: 1)', inline: false },
              { name: 'Ejemplos', value: '• `/unreplace` → Última\n• `/unreplace count:3` → Últimas 3', inline: false },
              { name: '👤 Role Requerido', value: 'Staff+', inline: true }
            ),

          new EmbedBuilder()
            .setColor(0x00cccc)
            .setTitle('🔄 /sync-variants')
            .setDescription('Sincronizar todos los productos (Admins SOLO)')
            .addFields(
              { name: 'Uso', value: '`/sync-variants`', inline: false },
              { name: '⏱️ Tiempo', value: '~18 segundos', inline: true },
              { name: '📊 Qué Hace', value: 'Descarga productos • Descubre variantes • Actualiza caché', inline: false }
            ),

          new EmbedBuilder()
            .setColor(0xcc00ff)
            .setTitle('📋 /invoice-view')
            .setDescription('Ver detalles de un producto')
            .addFields(
              { name: 'Parámetro', value: '• **product_id** (requerido): ID del producto', inline: false },
              { name: 'Ejemplo', value: '`/invoice-view product_id:386010`', inline: false }
            ),

          new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('💰 /balance-add')
            .setDescription('Agregar balance a cliente (Admin)')
            .addFields(
              { name: 'Parámetros', value: '• **email** (requerido)\n• **amount** (requerido)\n• **reason** (opcional)', inline: false }
            ),

          new EmbedBuilder()
            .setColor(0xff6600)
            .setTitle('💰 /balance-remove')
            .setDescription('Remover balance de cliente (Admin)')
            .addFields(
              { name: 'Parámetros', value: '• **email** (requerido)\n• **amount** (requerido)\n• **reason** (opcional)', inline: false }
            ),

          new EmbedBuilder()
            .setColor(0xff3333)
            .setTitle('🗑️ /clear')
            .setDescription('Eliminar mensajes del canal (Admin)')
            .addFields(
              { name: 'Parámetro', value: '• **amount** (1-100): Mensajes a eliminar', inline: false },
              { name: 'Ejemplo', value: '`/clear amount:50`', inline: false }
            ),

          new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('💾 /backup')
            .setDescription('Crear backup del servidor (Roles, Canales, Permisos)')
            .addFields(
              { name: 'Parámetro', value: '• **name** (requerido): Nombre del backup', inline: false },
              { name: 'Ejemplo', value: '`/backup name:antes-del-raid`', inline: false }
            ),

          new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle('🔄 /loadbackup')
            .setDescription('Restaurar servidor desde backup (Anti-raid)')
            .addFields(
              { name: 'Parámetros', value: '• **name** (requerido): Nombre del backup\n• **date** (requerido): Fecha (YYYY-MM-DD)', inline: false },
              { name: 'Ejemplo', value: '`/loadbackup name:antes-del-raid date:2025-11-22`', inline: false }
            ),

          new EmbedBuilder()
            .setColor(0x00aa00)
            .setTitle('📋 /listbackup')
            .setDescription('Listar todos los backups disponibles')
            .addFields(
              { name: 'Uso', value: '`/listbackup`', inline: false }
            ),

          new EmbedBuilder()
            .setColor(0xffaa00)
            .setTitle('📊 /stats')
            .setDescription('Ver estadísticas del sistema')
            .addFields(
              { name: 'Uso', value: '`/stats`', inline: false }
            ),

          new EmbedBuilder()
            .setColor(0xffaa00)
            .setTitle('🎯 Tips & Recomendaciones')
            .addFields(
              { name: '✅ Autocomplete', value: 'Todos los campos con autocomplete', inline: false },
              { name: '✅ Sincronización', value: 'Ejecuta `/sync-variants` diariamente', inline: false },
              { name: '✅ Backup', value: 'Crea backups antes de eventos importantes', inline: false },
              { name: '✅ Privacidad', value: 'Usa `visibility:private` para entregas confidenciales', inline: false }
            )
            .setFooter({ text: 'SellAuth Bot v1.0 | 13 Comandos' })
            .setTimestamp()
        ];

        await AdvancedCommandLogger.logCommand(interaction, 'help', {
          status: 'EXECUTED',
          result: `Help displayed with ${embeds.length} embeds`,
          executionTime: Date.now() - startTime,
          metadata: {
            'Embeds': embeds.length.toString()
          }
        });

        return { embeds };
      } catch (error) {
        console.error('[HELP] Error:', error);
        await AdvancedCommandLogger.logCommand(interaction, 'help', {
          status: 'ERROR',
          result: error.message,
          executionTime: Date.now() - startTime,
          errorCode: error.name,
          stackTrace: error.stack
        });
        return { content: `❌ Error: ${error.message}` };
      }
    });
  }
};