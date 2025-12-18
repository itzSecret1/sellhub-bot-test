import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AdvancedCommandLogger } from '../utils/advancedCommandLogger.js';
import { ErrorLog } from '../utils/errorLogger.js';
import { parseDeliverables } from '../utils/parseDeliverables.js';

const variantsDataPath = join(process.cwd(), 'variantsData.json');

export default {
  data: new SlashCommandBuilder()
    .setName('sync-variants')
    .setDescription('Sync all product variants from SellHub (Admin only)'),

  onlyWhitelisted: true,
  requiredRole: 'admin',

  async execute(interaction, api) {
    // CRITICAL: Defer reply IMMEDIATELY to prevent timeout (3 second limit)
    let deferred = false;
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
        deferred = true;
        console.log(`[SYNC] ✅ Deferred reply immediately`);
      }
    } catch (deferError) {
      console.error(`[SYNC] ❌ Failed to defer reply: ${deferError.message}`);
      // Try to send a quick reply instead
      try {
        await interaction.reply({ content: '⏳ Sincronizando...', ephemeral: true });
        deferred = true;
      } catch (replyError) {
        console.error(`[SYNC] ❌ Also failed to reply: ${replyError.message}`);
        return;
      }
    }
    
    // Log command asynchronously (don't wait for it)
    AdvancedCommandLogger.logCommand(interaction, 'sync-variants').catch(err => {
      console.error(`[SYNC] Logging error (non-critical): ${err.message}`);
    });
    
    try {

      const startTime = Date.now();
      const allVariants = {};
      let totalVariants = 0;
      let productsWithVariants = 0;
      const variantsList = [];
      const processedVariantIds = new Set();

      // STEP 1: Get all products with pagination
      console.log(`[SYNC] === STEP 1: Fetching all products ===`);
      let productList = [];
      let page = 1;
      let hasMoreProducts = true;

      while (hasMoreProducts && page <= 50) {
        try {
          // Fetch products from SellHub API
          console.log(`[SYNC] 📡 Fetching products page ${page}...`);
          console.log(`[SYNC] 📡 Endpoint: shops/${api.shopId}/products`);
          console.log(`[SYNC] 📡 Params: limit=100, page=${page}`);
          const products = await api.get(`shops/${api.shopId}/products`, { limit: 100, page: page });
          
          console.log(`[SYNC] 📦 Raw API response type: ${Array.isArray(products) ? 'array' : typeof products}`);
          console.log(`[SYNC] 📦 Raw API response keys: ${products ? Object.keys(products).join(', ') : 'null'}`);
          
          // Parse SellHub API response structure: { data: { products: [...] } }
          let pageProducts = [];
          if (Array.isArray(products)) {
            pageProducts = products;
          } else if (products?.data?.products && Array.isArray(products.data.products)) {
            // SellHub structure: { data: { products: [...] } }
            pageProducts = products.data.products;
          } else if (products?.data && Array.isArray(products.data)) {
            // Alternative structure: { data: [...] }
            pageProducts = products.data;
          } else if (products?.products && Array.isArray(products.products)) {
            // Alternative structure: { products: [...] }
            pageProducts = products.products;
          }
          
          console.log(`[SYNC] 📦 Parsed products count: ${pageProducts.length}`);
          
          if (pageProducts.length > 0) {
            console.log(`[SYNC] 📦 First product sample:`, JSON.stringify(pageProducts[0], null, 2).substring(0, 300));
          }

          if (pageProducts.length === 0) {
            hasMoreProducts = false;
            console.log(`[SYNC] No more products (page ${page})`);
          } else {
            productList = productList.concat(pageProducts);
            console.log(`[SYNC] Page ${page}: +${pageProducts.length} products (total: ${productList.length})`);
            page++;
          }
        } catch (e) {
          console.error(`[SYNC] Error fetching products page ${page}:`, e.message);
          hasMoreProducts = false;
        }
      }

      console.log(`[SYNC] Total products loaded: ${productList.length}`);

      let processedProducts = 0;
      let updateInterval = null;
      let lastUpdate = Date.now();
      try {
        updateInterval = setInterval(async () => {
          try {
            // Throttle updates to every 3 seconds to avoid rate limits
            if (Date.now() - lastUpdate < 3000) return;
            lastUpdate = Date.now();
            
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            // Prevent division by zero
            const percentage = productList.length > 0 ? Math.round((processedProducts / productList.length) * 100) : 0;
            const filled = Math.round(percentage / 5);
            const bar = `[${'█'.repeat(filled)}${'░'.repeat(20 - filled)}] ${percentage}%`;

            const message =
              `🔄 **SINCRONIZACIÓN EN PROGRESO**\n\n` +
              `${bar}\n\n` +
              `📊 Productos: ${processedProducts}/${productList.length}\n` +
              `🎮 Variantes: ${totalVariants}\n` +
              `⏱️ Tiempo: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

            if (interaction.deferred || interaction.replied) {
              await interaction.editReply({ content: message }).catch((err) => {
                console.error(`[SYNC] Update progress failed: ${err.message}`);
              });
            }
          } catch (err) {
            console.error(`[SYNC] Interval error: ${err.message}`);
          }
        }, 2000);
      } catch (err) {
        console.error(`[SYNC] Failed to start progress interval: ${err.message}`);
      }

      // STEP 2: Process each product's variants
      console.log(`[SYNC] === STEP 2: Processing product variants ===`);
      const variantsToFetchStock = []; // Store variants that need stock fetched
      
      for (const product of productList) {
        try {
          const variantMap = {};

          // Check if product has variants array
          // In SellHub, variants can be an array of IDs (strings) or objects
          if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
            for (const variant of product.variants) {
              // Handle both cases: variant as ID string or variant as object
              let variantId, variantName, variantStock;
              
              if (typeof variant === 'string') {
                // Variant is just an ID string - we need to fetch stock from deliverables
                variantId = variant;
                variantName = `Variant ${variantId}`;
                variantStock = 0; // Will be updated after fetching from deliverables
                
                // Add to list to fetch stock later
                variantsToFetchStock.push({
                  productId: product.id,
                  productName: product.name,
                  variantId: variantId,
                  variantName: variantName
                });
              } else if (variant && variant.id) {
                // Variant is an object - may have stock, but we'll verify with deliverables
                variantId = variant.id.toString();
                variantName = variant.name || `Variant ${variant.id}`;
                variantStock = variant.stock || 0; // Initial stock, will verify with deliverables
                
                // Even if variant has stock property, fetch real stock from deliverables
                variantsToFetchStock.push({
                  productId: product.id,
                  productName: product.name,
                  variantId: variantId,
                  variantName: variantName
                });
              } else {
                // Skip invalid variant
                continue;
              }

              if (!processedVariantIds.has(variantId)) {
                variantMap[variantId] = {
                  id: variantId,
                  name: variantName,
                  stock: variantStock // Will be updated after fetching
                };

                processedVariantIds.add(variantId);
                totalVariants++;
              }
            }

            // Only save products that have at least one valid variant
            if (Object.keys(variantMap).length > 0) {
              allVariants[product.id.toString()] = {
                productId: product.id,
                productName: product.name,
                variants: variantMap
              };
              productsWithVariants++;
            }
          }

          processedProducts++;
        } catch (e) {
          console.error(`Error processing product ${product.id}:`, e.message);
          processedProducts++;
        }
      }

      // STEP 2.5: Fetch real stock from deliverables for all variants
      // NOTE: This step is optional - if deliverables endpoint doesn't work, we'll skip it
      // and keep stock at 0 (which will be updated when items are actually used)
      console.log(`[SYNC] === STEP 2.5: Fetching real stock from deliverables (optional) ===`);
      console.log(`[SYNC] 📦 Attempting to fetch stock for ${variantsToFetchStock.length} variants...`);
      console.log(`[SYNC] ⚠️  Note: If endpoints fail, stock will remain at 0 (will be updated on use)`);
      
      let stockFetched = 0;
      let stockErrors = 0;
      
      for (let i = 0; i < variantsToFetchStock.length; i++) {
        const variantInfo = variantsToFetchStock[i];
        
        try {
          // CRITICAL: Wait at least 5 seconds between each request to avoid Cloudflare rate limits
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds between requests
          }
          
          // Try to fetch stock with retry logic for 429 errors
          let retries = 0;
          let deliverablesData = null;
          const maxRetries = 2;
          
          while (retries <= maxRetries) {
            try {
              deliverablesData = await api.get(
                `shops/${api.shopId}/products/${variantInfo.productId}/deliverables/${variantInfo.variantId}`
              );
              break; // Success, exit retry loop
            } catch (error) {
              // If 429 (rate limit), wait longer and retry
              if (error.status === 429 || (error.response && error.response.status === 429)) {
                retries++;
                if (retries <= maxRetries) {
                  const waitTime = 10000 * retries; // 10s, 20s
                  console.log(`[SYNC] ⚠️  Rate limited (429), waiting ${waitTime/1000}s before retry ${retries}/${maxRetries}...`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  continue;
                }
              }
              // If 404 or other error, don't retry
              throw error;
            }
          }
          
          if (deliverablesData) {
            const items = parseDeliverables(deliverablesData);
            const realStock = items.length;
            
            // Update stock in allVariants
            const productIdStr = variantInfo.productId.toString();
            if (allVariants[productIdStr] && allVariants[productIdStr].variants[variantInfo.variantId]) {
              allVariants[productIdStr].variants[variantInfo.variantId].stock = realStock;
              
              // Update variantsList for display
              const variantInList = variantsList.find(v => 
                v.productName === variantInfo.productName && 
                v.variantName === variantInfo.variantName
              );
              if (variantInList) {
                variantInList.stock = realStock;
              }
            }
            
            stockFetched++;
            console.log(`[SYNC] ✅ Stock for ${variantInfo.productName}/${variantInfo.variantName}: ${realStock}`);
          }
        } catch (e) {
          stockErrors++;
          // Log error but don't spam - only log every 5th error
          if (stockErrors % 5 === 1 || stockErrors <= 3) {
            console.error(`[SYNC] ⚠️  Could not fetch stock for ${variantInfo.productId}/${variantInfo.variantId}: ${e.message || 'Endpoint may not exist'}`);
          }
          // Continue with next variant - stock will remain at 0
        }
        
        // Progress update every 5 variants
        if ((i + 1) % 5 === 0) {
          console.log(`[SYNC] 📦 Progress: ${i + 1}/${variantsToFetchStock.length} variants processed (${stockFetched} successful, ${stockErrors} errors)`);
        }
      }
      
      if (stockFetched > 0) {
        console.log(`[SYNC] ✅ Successfully fetched stock for ${stockFetched}/${variantsToFetchStock.length} variants`);
      } else {
        console.log(`[SYNC] ⚠️  Could not fetch stock for any variants (endpoint may not be available). Stock will be updated when items are used.`);
      }
      
      if (stockErrors > 0) {
        console.log(`[SYNC] ⚠️  ${stockErrors} variants had errors fetching stock (this is normal if deliverables endpoint is not available)`);
      }

      // STEP 3: Discover missing variants from invoices (with pagination)
      console.log(`[SYNC] === STEP 3: Discovering variants from invoices ===`);
      try {
        let invoiceList = [];
        let invPage = 1;
        let hasMoreInvoices = true;

        while (hasMoreInvoices && invPage <= 50) {
          try {
            const invoices = await api.get(`shops/${api.shopId}/invoices`, { limit: 250, page: invPage });
            
            // Parse SellHub API response structure: { data: { invoices: [...] } } or { data: [...] } or [...]
            let pageInvoices = [];
            if (Array.isArray(invoices)) {
              pageInvoices = invoices;
            } else if (invoices?.data?.invoices && Array.isArray(invoices.data.invoices)) {
              // Structure: { data: { invoices: [...] } }
              pageInvoices = invoices.data.invoices;
            } else if (invoices?.data && Array.isArray(invoices.data)) {
              // Structure: { data: [...] }
              pageInvoices = invoices.data;
            } else if (invoices?.invoices && Array.isArray(invoices.invoices)) {
              // Structure: { invoices: [...] }
              pageInvoices = invoices.invoices;
            }

            if (pageInvoices.length === 0) {
              hasMoreInvoices = false;
              console.log(`[SYNC] No more invoices (page ${invPage})`);
            } else {
              invoiceList = invoiceList.concat(pageInvoices);
              console.log(
                `[SYNC] Invoices page ${invPage}: +${pageInvoices.length} invoices (total: ${invoiceList.length})`
              );
              invPage++;
            }
          } catch (e) {
            console.error(`[SYNC] Error fetching invoices page ${invPage}:`, e.message);
            hasMoreInvoices = false;
          }
        }

        console.log(`[SYNC] Total invoices loaded: ${invoiceList.length}`);

        for (const invoice of invoiceList) {
          try {
            if (!invoice.variant || !invoice.product) continue;

            const productId = invoice.product.id?.toString();
            const variantId = invoice.variant.id?.toString();

            if (!productId || !variantId) continue;
            if (processedVariantIds.has(variantId)) continue;

            // Add variant from invoice
            if (!allVariants[productId]) {
              allVariants[productId] = {
                productId: invoice.product.id,
                productName: invoice.product.name || `Product ${productId}`,
                variants: {}
              };
              productsWithVariants++;
            }

            allVariants[productId].variants[variantId] = {
              id: invoice.variant.id,
              name: invoice.variant.name || `Variant ${variantId}`,
              stock: invoice.variant.stock || 0
            };

            variantsList.push({
              productName: invoice.product.name,
              variantName: invoice.variant.name || `Variant ${variantId}`,
              stock: invoice.variant.stock || 0
            });

            processedVariantIds.add(variantId);
            totalVariants++;
          } catch (e) {
            // Silent fail for individual invoices
          }
        }
      } catch (e) {
        console.error(`[SYNC] Error discovering from invoices:`, e.message);
      }

      if (updateInterval) {
        clearInterval(updateInterval);
      }

      // Save to file
      try {
        writeFileSync(variantsDataPath, JSON.stringify(allVariants, null, 2));
      } catch (err) {
        console.error(`[SYNC] Error saving variantsData.json: ${err.message}`);
        ErrorLog.log('sync-variants', err, { stage: 'FILE_SAVE' });
      }
      const totalTime = Math.round((Date.now() - startTime) / 1000);

      console.log(`[SYNC] === SYNC COMPLETE ===`);
      console.log(`[SYNC] Scanned: ${productList.length} products`);
      console.log(`[SYNC] Found: ${totalVariants} variants in ${productsWithVariants} products`);
      console.log(`[SYNC] Time: ${totalTime}s`);

      // Create detailed report message
      let reportText = `✅ **¡Sincronización Completada!**\n\n`;
      reportText += `**📊 Estadísticas:**\n`;
      reportText += `• Productos escaneados: ${productList.length}\n`;
      reportText += `• Productos con variantes: ${productsWithVariants}\n`;
      reportText += `• Variantes totales: ${totalVariants}\n`;
      reportText += `• Tiempo total: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s\n\n`;
      reportText += `**🎮 Variantes Detectadas (primeras 30):**\n`;

      // Add first 30 variants safely
      for (let i = 0; i < Math.min(30, variantsList.length); i++) {
        const v = variantsList[i];
        const stockEmoji = v.stock > 0 ? '✅' : '❌';
        reportText += `${stockEmoji} ${v.productName} → ${v.variantName} (${v.stock})\n`;
      }

      if (variantsList.length > 30) {
        reportText += `\n... y ${variantsList.length - 30} variantes más\n`;
      }

      reportText += `\n💾 Datos guardados. Usa **/stock** para verificar.`;

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ ¡Sincronización Completada!')
        .setDescription(reportText.substring(0, 4096))
        .setTimestamp();

      if (updateInterval) {
        clearInterval(updateInterval);
      }

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] }).catch((err) => {
          console.error(`[SYNC] Failed to send completion embed: ${err.message}`);
        });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true }).catch((err) => {
          console.error(`[SYNC] Failed to reply with completion embed: ${err.message}`);
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      
      if (updateInterval) {
        clearInterval(updateInterval);
      }

      ErrorLog.log('sync-variants', error, { stage: 'OUTER_EXCEPTION' });

      if (interaction.deferred || interaction.replied) {
        await interaction
          .editReply({
            content: `❌ Error en sincronización: ${error.message}`
          })
          .catch((err) => {
            console.error(`[SYNC] Failed to send error reply: ${err.message}`);
          });
      } else {
        await interaction
          .reply({
            content: `❌ Error en sincronización: ${error.message}`,
            ephemeral: true
          })
          .catch((err) => {
            console.error(`[SYNC] Failed to reply with error: ${err.message}`);
          });
      }
    }
  }
};
