import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ErrorLog } from '../utils/errorLogger.js';
import { Api } from '../classes/Api.js';
import { AdvancedCommandLogger } from '../utils/advancedCommandLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('invoice-view')
    .setDescription('📋 Ver detalles completos de un invoice')
    .addStringOption((option) => 
      option.setName('id')
        .setDescription('Invoice ID (ej: b760aea28c094-0000008016578)')
        .setRequired(true)
    ),

  onlyWhitelisted: true,
  requiredRole: 'staff',

  async execute(interaction) {
    const startTime = Date.now();
    try {
      await interaction.deferReply({ ephemeral: true });

      const inputId = interaction.options.getString('id');

      // Validate input
      if (!inputId || inputId.trim() === '') {
        await interaction.editReply({
          content: '❌ Debes proporcionar un Invoice ID\n💡 Formato: `b760aea28c094-0000008016578`\n💡 Solo caracteres alfanuméricos y guiones (-)'
        });
        return;
      }

      const cleanId = inputId.trim();
      console.log(`[INVOICE-VIEW] Searching invoice: "${cleanId}"`);

      // Validate invoice ID format - alphanumeric and hyphens only
      if (!/^[a-zA-Z0-9\-]+$/.test(cleanId)) {
        await interaction.editReply({
          content: `❌ Formato inválido: \`${cleanId}\`\n✅ Solo caracteres alfanuméricos (a-z, 0-9) y guiones (-)\n💡 Ejemplo válido: \`b760aea28c094-0000008016578\``
        });

        await AdvancedCommandLogger.logCommand(interaction, 'invoice-view', {
          status: 'EXECUTED',
          result: `Invalid format: ${cleanId}`,
          executionTime: Date.now() - startTime,
          metadata: {
            'Invoice ID': cleanId,
            'Result': 'Invalid Format'
          }
        });
        return;
      }

      try {
        // Search invoice via API - using correct endpoint pattern from sync-variants
        const api = new Api();
        console.log(`[INVOICE-VIEW] Searching for invoice ID: "${cleanId}"`);

        let invoiceData = null;
        let foundOnPage = false;
        let totalInvoicesSearched = 0;
        let debugSamples = [];

        // Paginate through invoices to find matching ID - search up to 50 pages (12,500 invoices)
        console.log(`[INVOICE-VIEW] Starting comprehensive search - looking for ID: "${cleanId}"`);
        
        for (let page = 1; page <= 50; page++) {
          try {
            const response = await api.get(`shops/${api.shopId}/invoices?limit=250&page=${page}`);
            
            // Handle both array and object responses
            const invoicesList = Array.isArray(response) ? response : response?.data || [];
            console.log(`[INVOICE-VIEW] Page ${page}: ${invoicesList.length} invoices`);

            if (invoicesList.length === 0) {
              console.log(`[INVOICE-VIEW] No more invoices found - stopping search after ${totalInvoicesSearched} invoices`);
              break;
            }

            totalInvoicesSearched += invoicesList.length;

            // Search for invoice by ID in current page - debug each invoice on first page
            for (let i = 0; i < invoicesList.length; i++) {
              const inv = invoicesList[i];
              
              // Debug samples from first 2 pages
              if (page <= 2 && i < 3) {
                debugSamples.push(`  Page ${page} Invoice ${i}: id="${inv.id}" (${typeof inv.id}), invoice_id="${inv.invoice_id}", reference_id="${inv.reference_id}"`);
              }

              // Check all possible ID field combinations
              const idMatch = inv.id === cleanId || 
                              inv.invoice_id === cleanId || 
                              inv.reference_id === cleanId ||
                              (inv.id && inv.id.toString() === cleanId) ||
                              (inv.invoice_id && inv.invoice_id.toString() === cleanId);

              if (idMatch) {
                invoiceData = inv;
                foundOnPage = true;
                console.log(`[INVOICE-VIEW] ✅ FOUND Invoice on page ${page}!`);
                console.log(`[INVOICE-VIEW] ✅ Matched ID field: id=${inv.id}, invoice_id=${inv.invoice_id}, reference_id=${inv.reference_id}`);
                break;
              }
            }

            if (foundOnPage) break;

          } catch (apiError) {
            console.error(`[INVOICE-VIEW] Error fetching page ${page}:`, apiError.message);
            if (apiError.status === 429) {
              console.warn(`[INVOICE-VIEW] Rate limited on page ${page}`);
              throw apiError;
            }
            // Continue to next page on other errors
          }
        }

        // Log debug samples for analysis
        if (debugSamples.length > 0 && !foundOnPage) {
          console.log(`[INVOICE-VIEW] DEBUG - Sample invoice IDs from API:`);
          debugSamples.forEach(s => console.log(s));
          console.log(`[INVOICE-VIEW] DEBUG - Searching for: "${cleanId}" (${typeof cleanId})`);
        }

        console.log(`[INVOICE-VIEW] Search complete: Searched ${totalInvoicesSearched} invoices, Found: ${foundOnPage}`);

        // Check if invoice was found
        if (!invoiceData || !foundOnPage) {
          await interaction.editReply({
            content: `❌ Invoice **no encontrado**: \`${cleanId}\`\n\n💡 Verifica:\n  • El ID sea correcto\n  • El invoice exista en el sistema SellAuth\n  • Contacta al admin si el problema persiste`
          });

          await AdvancedCommandLogger.logCommand(interaction, 'invoice-view', {
            status: 'EXECUTED',
            result: `Invoice not found after searching pages`,
            executionTime: Date.now() - startTime,
            metadata: {
              'Invoice ID': cleanId,
              'Result': 'Not Found',
              'Total Invoices Searched': totalInvoicesSearched.toString(),
              'Max Pages': '50'
            }
          });
          return;
        }

        // Check if response is empty object
        if (typeof invoiceData === 'object' && Object.keys(invoiceData).length === 0) {
          await interaction.editReply({
            content: `❌ Invoice vacío o incompleto: \`${cleanId}\``
          });

          await AdvancedCommandLogger.logCommand(interaction, 'invoice-view', {
            status: 'EXECUTED',
            result: `Empty invoice response`,
            executionTime: Date.now() - startTime,
            metadata: {
              'Invoice ID': cleanId,
              'Result': 'Empty Response'
            }
          });
          return;
        }

        // Build invoice embed with ALL available data
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle('📋 DETALLES DEL INVOICE')
          .setDescription(`Invoice: \`${cleanId}\``);

        // Add all available fields
        if (invoiceData.product_name || invoiceData.product) {
          embed.addFields({
            name: '🛍️ Producto',
            value: (invoiceData.product_name || invoiceData.product).substring(0, 100),
            inline: true
          });
        }

        if (invoiceData.amount) {
          embed.addFields({
            name: '💰 Monto',
            value: `$${invoiceData.amount}`,
            inline: true
          });
        }

        if (invoiceData.created_at) {
          embed.addFields({
            name: '📅 Fecha Creación',
            value: invoiceData.created_at.substring(0, 10),
            inline: true
          });
        }

        if (invoiceData.status) {
          embed.addFields({
            name: '✅ Estado',
            value: invoiceData.status.toUpperCase(),
            inline: true
          });
        }

        if (invoiceData.order_id) {
          embed.addFields({
            name: '📦 Order ID',
            value: invoiceData.order_id.toString(),
            inline: true
          });
        }

        if (invoiceData.customer_name || invoiceData.customer_email) {
          const customerInfo = `${invoiceData.customer_name || 'N/A'} (${invoiceData.customer_email || 'N/A'})`;
          embed.addFields({
            name: '👤 Cliente',
            value: customerInfo.substring(0, 100),
            inline: false
          });
        }

        if (invoiceData.notes || invoiceData.description) {
          const notes = (invoiceData.notes || invoiceData.description).substring(0, 200);
          embed.addFields({
            name: '📝 Notas',
            value: notes,
            inline: false
          });
        }

        embed.setFooter({ text: 'SellAuth Bot | Invoice Lookup' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        const executionTime = Date.now() - startTime;
        await AdvancedCommandLogger.logCommand(interaction, 'invoice-view', {
          status: 'EXECUTED',
          result: `Invoice found successfully`,
          executionTime,
          metadata: {
            'Invoice ID': cleanId,
            'Product': invoiceData.product_name || 'N/A',
            'Amount': `$${invoiceData.amount || 0}`,
            'Status': invoiceData.status || 'Unknown',
            'Found': 'YES'
          }
        });

        console.log(`[INVOICE-VIEW] ✅ Invoice ${cleanId} retrieved successfully by ${interaction.user.username}`);
      } catch (invoiceError) {
        console.error('[INVOICE-VIEW] Invoice search error:', invoiceError);
        
        let errorMsg = invoiceError.message || 'Unknown error';
        if (invoiceError.status === 404) {
          errorMsg = `Invoice no encontrado (404)`;
        } else if (invoiceError.status === 429) {
          errorMsg = `Rate limited - intenta de nuevo en unos segundos`;
        } else if (invoiceError.status === 504) {
          errorMsg = `API timeout - intenta de nuevo`;
        }

        await interaction.editReply({
          content: `❌ Error al buscar invoice: \`${errorMsg}\``
        });

        await AdvancedCommandLogger.logCommand(interaction, 'invoice-view', {
          status: 'ERROR',
          result: errorMsg,
          executionTime: Date.now() - startTime,
          metadata: {
            'Invoice ID': cleanId,
            'Error Status': invoiceError.status || 'Unknown',
            'Error Type': invoiceError.name || 'API Error'
          },
          errorCode: invoiceError.name || 'API_ERROR',
          stackTrace: invoiceError.stack
        });
      }
    } catch (error) {
      console.error('[INVOICE-VIEW] Critical Error:', error);
      ErrorLog.log('invoice-view', error, {
        stage: 'OUTER_EXCEPTION',
        inputId: interaction.options.getString('id'),
        userId: interaction.user.id,
        userName: interaction.user.username
      });

      try {
        await interaction.editReply({
          content: `❌ Error crítico: ${error.message}`
        });
      } catch (e) {
        console.error('[INVOICE-VIEW] Reply failed:', e.message);
      }

      await AdvancedCommandLogger.logCommand(interaction, 'invoice-view', {
        status: 'ERROR',
        result: error.message,
        executionTime: Date.now() - startTime,
        metadata: {
          'Error Stage': 'CRITICAL',
          'Error Type': error.name
        },
        errorCode: error.name,
        stackTrace: error.stack
      });
    }
  }
};