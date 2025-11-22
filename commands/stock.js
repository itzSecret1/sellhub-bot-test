import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const variantsDataPath = join(process.cwd(), 'variantsData.json');

function loadVariantsData() {
  if (existsSync(variantsDataPath)) {
    try {
      return JSON.parse(readFileSync(variantsDataPath, 'utf-8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

async function getVariantRealItems(api, productId, variantId) {
  try {
    const deliverablesData = await api.get(
      `shops/${api.shopId}/products/${productId}/deliverables/${variantId}`
    );
    
    let items = [];
    
    if (typeof deliverablesData === 'string') {
      items = deliverablesData.split('\n').filter(item => item.trim());
    } else if (deliverablesData?.deliverables && typeof deliverablesData.deliverables === 'string') {
      items = deliverablesData.deliverables.split('\n').filter(item => item.trim());
    } else if (deliverablesData?.content && typeof deliverablesData.content === 'string') {
      items = deliverablesData.content.split('\n').filter(item => item.trim());
    } else if (deliverablesData?.data && typeof deliverablesData.data === 'string') {
      items = deliverablesData.data.split('\n').filter(item => item.trim());
    } else if (Array.isArray(deliverablesData)) {
      items = deliverablesData.map(item => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object' && item?.value) return item.value;
        return String(item).trim();
      }).filter(item => item);
    } else if (deliverablesData?.items && Array.isArray(deliverablesData.items)) {
      items = deliverablesData.items.map(item => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object' && item?.value) return item.value;
        return String(item).trim();
      }).filter(item => item);
    } else if (typeof deliverablesData === 'object' && deliverablesData !== null) {
      items = Object.values(deliverablesData).map(val => String(val).trim()).filter(item => item);
    }
    
    return items;
  } catch (e) {
    console.error(`[STOCK] Error fetching items for ${productId}/${variantId}:`, e.message);
    return [];
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Check stock of products and see real items')
    .addStringOption(option => 
      option.setName('product')
        .setDescription('Product name or ID (optional)')
        .setRequired(false)
        .setAutocomplete(true))
    .addStringOption(option => 
      option.setName('variant')
        .setDescription('Variant name or ID (optional, requires product)')
        .setRequired(false)
        .setAutocomplete(true)),

  onlyWhitelisted: true,
  requiredRole: 'staff',

  async autocomplete(interaction, api) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      let responded = false;
      
      try {
        if (focusedOption.name === 'product') {
          const variantsData = loadVariantsData();
          const products = Object.values(variantsData)
            .map(p => ({ 
              name: p.productName, 
              id: p.productId 
            }))
            .filter(p => p.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
            .slice(0, 25);

          await interaction.respond(
            products.map(p => ({ name: p.name, value: p.id.toString() }))
          );
          responded = true;
        } 
        else if (focusedOption.name === 'variant') {
          const productInput = interaction.options.getString('product');
          
          if (!productInput) {
            await interaction.respond([]);
            responded = true;
            return;
          }

          const variantsData = loadVariantsData();
          const productData = Object.values(variantsData).find(p => 
            p.productId.toString() === productInput
          );

          if (!productData || !productData.variants) {
            await interaction.respond([]);
            responded = true;
            return;
          }

          const variants = Object.values(productData.variants)
            .map(v => ({
              name: `${v.name} (${v.stock})`,
              value: v.id.toString()
            }))
            .slice(0, 25);

          await interaction.respond(variants);
          responded = true;
        }
      } catch (e) {
        if (!responded && interaction.responded === false) {
          try {
            await interaction.respond([]);
          } catch (respondError) {
            // Silent fail
          }
        }
      }
    } catch (error) {
      // Silent fail
    }
  },

  async execute(interaction, api) {
    try {
      // Quick response to prevent timeout
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
      }

      const productInput = interaction.options.getString('product');
      const variantInput = interaction.options.getString('variant');

      const variantsData = loadVariantsData();

      // Case 1: No parameters - show ALL stock
      if (!productInput && !variantInput) {
        const embeds = [];
        
        Object.entries(variantsData).forEach(([productId, productData]) => {
          const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`📦 ${productData.productName}`);

          const variantsList = Object.values(productData.variants || {})
            .map(v => `• **${v.name}**: ${v.stock} items`)
            .join('\n');

          if (variantsList) {
            embed.setDescription(variantsList || 'No variants');
          } else {
            embed.setDescription('No variants');
          }

          embeds.push(embed);
        });

        if (embeds.length === 0) {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: `❌ No hay datos de stock. Ejecuta /sync-variants primero.`
            }).catch(() => {});
          } else {
            await interaction.reply({
              content: `❌ No hay datos de stock. Ejecuta /sync-variants primero.`,
              ephemeral: true
            }).catch(() => {});
          }
          return;
        }

        const firstBatch = embeds.slice(0, 10);
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: firstBatch }).catch(() => {});
        } else {
          await interaction.reply({ embeds: firstBatch, ephemeral: true }).catch(() => {});
        }

        for (let i = 10; i < embeds.length; i += 10) {
          const batch = embeds.slice(i, i + 10);
          await interaction.followUp({ embeds: batch, ephemeral: true });
        }
        return;
      }

      // Case 2: Product specified but not variant - show all variants of that product
      if (productInput && !variantInput) {
        const productData = Object.values(variantsData).find(p => 
          p.productId.toString() === productInput
        );

        if (!productData) {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: `❌ Producto no encontrado.`
            }).catch(() => {});
          } else {
            await interaction.reply({
              content: `❌ Producto no encontrado.`,
              ephemeral: true
            }).catch(() => {});
          }
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle(`📦 Stock: ${productData.productName}`);

        const variantsList = Object.values(productData.variants || {})
          .map(v => `• **${v.name}**: ${v.stock} items`)
          .join('\n');

        embed.setDescription(variantsList || 'No hay variantes');

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [embed] }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
        }
        return;
      }

      // Case 3: Both product and variant specified - show REAL items
      if (productInput && variantInput) {
        const productData = Object.values(variantsData).find(p => 
          p.productId.toString() === productInput
        );

        if (!productData) {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: `❌ Producto no encontrado.`
            }).catch(() => {});
          } else {
            await interaction.reply({
              content: `❌ Producto no encontrado.`,
              ephemeral: true
            }).catch(() => {});
          }
          return;
        }

        const variant = productData.variants?.[variantInput];

        if (!variant) {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: `❌ Variante no encontrada.`
            }).catch(() => {});
          } else {
            await interaction.reply({
              content: `❌ Variante no encontrada.`,
              ephemeral: true
            }).catch(() => {});
          }
          return;
        }

        // Fetch REAL items from API
        const realItems = await getVariantRealItems(api, productData.productId, variantInput);
        
        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle(`📦 Stock Detallado`)
          .addFields(
            { name: '🏪 Producto', value: productData.productName, inline: false },
            { name: '🎮 Variante', value: variant.name, inline: false },
            { name: '📊 Stock Reportado', value: `**${variant.stock}** items`, inline: false },
            { name: '🔍 Stock Real (Items)', value: `**${realItems.length}** items`, inline: false }
          );

        // Add items if any
        if (realItems.length > 0) {
          let itemsText = '';
          
          // Show items grouped in chunks
          for (let i = 0; i < Math.min(20, realItems.length); i++) {
            itemsText += `${i + 1}. ${realItems[i]}\n`;
          }

          if (realItems.length > 20) {
            itemsText += `\n... y ${realItems.length - 20} items más`;
          }

          embed.addFields({ 
            name: '📋 Items (primeros)', 
            value: itemsText || 'Sin items', 
            inline: false 
          });
        }

        // Discrepancy warning
        if (realItems.length !== variant.stock) {
          embed.setColor(0xFF6600);
          embed.addFields({
            name: '⚠️ DISCREPANCIA DETECTADA',
            value: `Cache: ${variant.stock} vs Real: ${realItems.length}. Ejecuta /sync-variants para actualizar.`,
            inline: false
          });
        }

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [embed] }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
        }
        return;
      }

    } catch (error) {
      console.error('[STOCK] Error:', error);
      await interaction.editReply({ 
        content: `❌ Error: ${error.message}` 
      }).catch(() => {});
    }
  }
};
