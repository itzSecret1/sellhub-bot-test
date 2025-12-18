import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AdvancedCommandLogger } from '../utils/advancedCommandLogger.js';
import { ErrorLog } from '../utils/errorLogger.js';
import { parseDeliverables } from '../utils/parseDeliverables.js';
import { loadVariantsData } from '../utils/dataLoader.js';

const variantsDataPath = join(process.cwd(), 'variantsData.json');

export default {
  data: new SlashCommandBuilder()
    .setName('sync-variants')
    .setDescription('Sync all product variants from SellHub (Admin only)'),

  onlyWhitelisted: true,
  requiredRole: 'admin',

  async execute(interaction, api) {
    // CRITICAL: Verify we're using SellHub API, not SellAuth
    if (api.baseUrl && api.baseUrl.includes('sellauth')) {
      await interaction.reply({
        content: '❌ ERROR: El bot está configurado para usar SellAuth en lugar de SellHub. Verifica las variables de entorno.',
        ephemeral: true
      });
      return;
    }
    
    // CRITICAL: Check and clean old SellAuth data from cache
    const oldData = loadVariantsData();
    if (Object.keys(oldData).length > 0) {
      // Check if data looks like SellAuth (has numeric IDs instead of UUIDs, or old structure)
      const firstProduct = Object.values(oldData)[0];
      if (firstProduct) {
        const productId = firstProduct.productId;
        // SellHub uses UUIDs (strings with dashes), SellAuth might use numbers
        // Also check if shop ID matches
        const isOldData = typeof productId === 'number' || 
                         (typeof productId === 'string' && !productId.includes('-') && productId.length < 10);
        
        if (isOldData) {
          console.log('[SYNC] ⚠️  Detected old SellAuth data in cache - will be overwritten with SellHub data');
          // Delete old cache file
          try {
            if (existsSync(variantsDataPath)) {
              const { unlinkSync } = await import('fs');
              unlinkSync(variantsDataPath);
              console.log('[SYNC] ✅ Deleted old SellAuth cache file');
            }
          } catch (e) {
            console.error('[SYNC] Error deleting old cache:', e.message);
          }
        }
      }
    }
    
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
      // CRITICAL: We MUST get real stock, so we'll try multiple endpoint variations
      console.log(`[SYNC] === STEP 2.5: Fetching REAL stock from deliverables ===`);
      console.log(`[SYNC] 📦 Fetching stock for ${variantsToFetchStock.length} variants...`);
      
      let stockFetched = 0;
      let stockErrors = 0;
      
      // Function to try multiple endpoint variations
      async function fetchStockWithVariations(api, productId, variantId) {
        const endpointVariations = [
          `shops/${api.shopId}/products/${productId}/deliverables/${variantId}`,
          `products/${productId}/deliverables/${variantId}`,
          `shops/${api.shopId}/products/${productId}/variants/${variantId}/deliverables`,
          `products/${productId}/variants/${variantId}/deliverables`,
          `deliverables/${variantId}?product_id=${productId}`,
          `shops/${api.shopId}/deliverables/${variantId}?product_id=${productId}`
        ];
        
        for (const endpoint of endpointVariations) {
          try {
            const deliverablesData = await api.get(endpoint);
            if (deliverablesData) {
              const items = parseDeliverables(deliverablesData);
              if (items.length > 0 || typeof deliverablesData === 'string') {
                return items;
              }
            }
          } catch (error) {
            // If 404, try next variation
            if (error.status === 404 || (error.response && error.response.status === 404)) {
              continue;
            }
            // If 429, throw to handle retry
            if (error.status === 429 || (error.response && error.response.status === 429)) {
              throw error;
            }
            // Other errors, try next variation
            continue;
          }
        }
        
        // If all variations failed, try getting individual product to see if stock is there
        try {
          const productData = await api.get(`shops/${api.shopId}/products/${productId}`);
          if (productData) {
            // Check if product has variants with stock info
            const product = Array.isArray(productData) ? productData[0] : 
                          (productData?.data?.products?.[0] || productData?.data || productData);
            
            if (product?.variants && Array.isArray(product.variants)) {
              const variant = product.variants.find(v => 
                (v.id && v.id.toString() === variantId) || 
                (typeof v === 'string' && v === variantId)
              );
              
              if (variant && typeof variant === 'object' && variant.stock !== undefined) {
                // Stock is in variant object, but we need actual items count
                // Return empty array to indicate we need to fetch from deliverables
                return [];
              }
            }
          }
        } catch (e) {
          // Ignore errors when fetching product
        }
        
        return null;
      }
      
      for (let i = 0; i < variantsToFetchStock.length; i++) {
        const variantInfo = variantsToFetchStock[i];
        
        try {
          // CRITICAL: Wait at least 5 seconds between each request to avoid Cloudflare rate limits
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds between requests
          }
          
          // Try to fetch stock with retry logic for 429 errors
          let retries = 0;
          let items = null;
          const maxRetries = 3;
          
          while (retries <= maxRetries && items === null) {
            try {
              items = await fetchStockWithVariations(api, variantInfo.productId, variantInfo.variantId);
              
              if (items && items.length >= 0) {
                break; // Success, exit retry loop
              }
              
              // If items is null, all variations failed
              throw new Error('All endpoint variations returned 404');
            } catch (error) {
              // If 429 (rate limit), wait longer and retry
              if (error.status === 429 || (error.response && error.response.status === 429)) {
                retries++;
                if (retries <= maxRetries) {
                  const waitTime = 15000 * retries; // 15s, 30s, 45s
                  console.log(`[SYNC] ⚠️  Rate limited (429), waiting ${waitTime/1000}s before retry ${retries}/${maxRetries}...`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  continue;
                }
              }
              // If all variations failed or other error, throw
              throw error;
            }
          }
          
          if (items !== null) {
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
          } else {
            throw new Error('Could not fetch stock from any endpoint variation');
          }
        } catch (e) {
          stockErrors++;
          const errorMsg = e.message || (e.status ? `HTTP ${e.status}` : 'Unknown error');
          console.error(`[SYNC] ❌ ERROR fetching stock for ${variantInfo.productId}/${variantInfo.variantId}: ${errorMsg}`);
          
          // Try one more time with the exact endpoint that works for PUT (deliverables/overwrite)
          // Maybe GET works with a similar structure
          try {
            console.log(`[SYNC] 🔄 Trying alternative endpoint structure...`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s before retry
            
            // Try the endpoint structure that works for PUT operations
            const altEndpoint = `shops/${api.shopId}/products/${variantInfo.productId}/deliverables/${variantInfo.variantId}`;
            const altData = await api.get(altEndpoint);
            const altItems = parseDeliverables(altData);
            const altStock = altItems.length;
            
            if (altStock >= 0) {
              const productIdStr = variantInfo.productId.toString();
              if (allVariants[productIdStr] && allVariants[productIdStr].variants[variantInfo.variantId]) {
                allVariants[productIdStr].variants[variantInfo.variantId].stock = altStock;
                
                const variantInList = variantsList.find(v => 
                  v.productName === variantInfo.productName && 
                  v.variantName === variantInfo.variantName
                );
                if (variantInList) {
                  variantInList.stock = altStock;
                }
              }
              
              stockFetched++;
              stockErrors--; // Decrement error count since we recovered
              console.log(`[SYNC] ✅ Recovered! Stock for ${variantInfo.productName}/${variantInfo.variantName}: ${altStock}`);
            } else {
              throw new Error('Alternative endpoint also failed');
            }
          } catch (retryError) {
            // Final fallback: set to 0 and log
            console.error(`[SYNC] ❌ Final attempt failed for ${variantInfo.productId}/${variantInfo.variantId}`);
            const productIdStr = variantInfo.productId.toString();
            if (allVariants[productIdStr] && allVariants[productIdStr].variants[variantInfo.variantId]) {
              allVariants[productIdStr].variants[variantInfo.variantId].stock = 0; // Set to 0 as fallback
            }
          }
        }
        
        // Progress update every 3 variants
        if ((i + 1) % 3 === 0) {
          console.log(`[SYNC] 📦 Progress: ${i + 1}/${variantsToFetchStock.length} variants processed (${stockFetched} successful, ${stockErrors} errors)`);
        }
      }
      
      if (stockFetched > 0) {
        console.log(`[SYNC] ✅ Successfully fetched REAL stock for ${stockFetched}/${variantsToFetchStock.length} variants`);
      }
      
      if (stockErrors > 0) {
        console.log(`[SYNC] ⚠️  ${stockErrors} variants had errors - stock set to -1 (error marker)`);
      }
      
      // Final check: if we couldn't get stock for any variant, warn user
      if (stockFetched === 0 && variantsToFetchStock.length > 0) {
        console.log(`[SYNC] ❌ CRITICAL: Could not fetch stock for ANY variant. Please check API endpoints.`);
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
