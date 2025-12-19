import axios from 'axios';
import { config } from '../utils/config.js';

export class Api {
  constructor() {
    // Base URL according to official SellHub docs: https://dash.sellhub.cx/api/sellhub/
    // IMPORTANT: This bot ONLY supports SellHub, NOT SellAuth
    this.baseUrl = 'https://dash.sellhub.cx/api/sellhub/';
    this.apiKey = config.SH_API_KEY;
    this.shopId = config.SH_SHOP_ID || null; // Optional - will be auto-detected from API
    this.endpointPrefix = ''; // Will be determined dynamically
    this._shopIdPromise = null; // Cache for shop ID detection promise
    
    // Validate configuration on initialization
    if (!this.apiKey) {
      throw new Error('SH_API_KEY is required. This bot only supports SellHub, not SellAuth.');
    }
    if (this.baseUrl.includes('sellauth')) {
      throw new Error('Invalid base URL: SellAuth is not supported. Use SellHub (dash.sellhub.cx)');
    }
    
    // Shop ID is optional - will be detected automatically if not provided
    if (this.shopId) {
      console.log(`[API] Shop ID provided: ${this.shopId.substring(0, 20)}...`);
    } else {
      console.log(`[API] Shop ID not provided - will be auto-detected from API`);
    }
  }
  
  /**
   * Auto-detect shop ID from API response
   * Tries to get shop info from various endpoints
   */
  async detectShopId() {
    // If already detected, return cached value
    if (this.shopId) {
      return this.shopId;
    }
    
    // If detection is in progress, wait for it
    if (this._shopIdPromise) {
      return await this._shopIdPromise;
    }
    
    // Start detection
    this._shopIdPromise = this._performShopIdDetection();
    try {
      this.shopId = await this._shopIdPromise;
      return this.shopId;
    } catch (error) {
      this._shopIdPromise = null; // Reset on error so we can retry
      throw error;
    }
  }
  
  async _performShopIdDetection() {
    console.log(`[API] 🔍 Auto-detecting shop ID from API...`);
    
    // Try to get shop info from various endpoints
    const detectionEndpoints = [
      'shop', // Try /shop endpoint
      'me', // Try /me endpoint
      'account', // Try /account endpoint
      'products?limit=1' // Try products and extract shop_id from response
    ];
    
    for (const endpoint of detectionEndpoints) {
      try {
        console.log(`[API] Trying to detect shop ID from: ${endpoint}`);
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          headers: { 
            'Authorization': this.apiKey,
            'Accept': 'application/json'
          },
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        
        if (response.status === 200 && response.data) {
          // Try to extract shop ID from various response structures
          const shopId = response.data?.shop_id || 
                        response.data?.shopId || 
                        response.data?.id ||
                        response.data?.data?.shop_id ||
                        response.data?.data?.shopId ||
                        response.data?.data?.id;
          
          if (shopId) {
            console.log(`[API] ✅ Shop ID detected: ${shopId}`);
            return shopId;
          }
          
          // If products endpoint, try to get shop_id from first product
          if (endpoint.includes('products')) {
            const products = Array.isArray(response.data) ? response.data : 
                           response.data?.data || 
                           response.data?.products || [];
            if (products.length > 0 && products[0]?.shop_id) {
              const detectedShopId = products[0].shop_id;
              console.log(`[API] ✅ Shop ID detected from products: ${detectedShopId}`);
              return detectedShopId;
            }
          }
        }
      } catch (error) {
        // Continue to next endpoint
        continue;
      }
    }
    
    // If all detection methods fail, return null (endpoints will work without shop ID)
    console.log(`[API] ⚠️  Could not auto-detect shop ID - will try endpoints without shop ID`);
    return null;
  }
  
  /**
   * Get shop ID - returns provided value or auto-detects if needed
   */
  async getShopId() {
    if (this.shopId) {
      return this.shopId;
    }
    return await this.detectShopId();
  }

  async get(endpoint, params = {}) {
    // According to official docs: https://dash.sellhub.cx/api/sellhub/{recurso}
    // Examples: /api/sellhub/customers, /api/sellhub/products
    
    // Get shop ID if needed (auto-detect if not provided)
    const shopId = await this.getShopId();
    
    // Extract resource type from endpoint
    // Endpoints can come as: shops/{shopId}/products OR just products
    let resourceType = '';
    let resourcePath = '';
    
    // Remove shop ID prefix if present
    let cleanEndpoint = endpoint;
    if (shopId && endpoint.includes(`shops/${shopId}/`)) {
      cleanEndpoint = endpoint.replace(`shops/${shopId}/`, '');
    } else if (endpoint.startsWith('shops/')) {
      // Remove any shop ID pattern
      cleanEndpoint = endpoint.replace(/^shops\/[^/]+\//, '');
    }
    
    if (cleanEndpoint.includes('/deliverables/')) {
      resourceType = 'deliverables';
      resourcePath = cleanEndpoint;
    } else if (cleanEndpoint.includes('/products/')) {
      resourceType = 'products';
      resourcePath = cleanEndpoint;
    } else if (cleanEndpoint.includes('products')) {
      resourceType = 'products';
      resourcePath = 'products';
    } else if (cleanEndpoint.includes('invoices')) {
      resourceType = 'invoices';
      resourcePath = 'invoices';
    } else {
      const parts = cleanEndpoint.split('/');
      resourceType = parts[parts.length - 1] || cleanEndpoint;
      resourcePath = cleanEndpoint;
    }
    
    // Build endpoint variations - try WITHOUT shop ID first (SellHub API key contains shop info)
    // IMPORTANT: Based on logs, /products works without shop ID, but /deliverables fails WITH shop ID
    const endpointVariations = [];
    
    // For deliverables, use ONLY the correct endpoint structure
    if (resourceType === 'deliverables' || cleanEndpoint.includes('deliverables')) {
      // Only use: products/{productId}/deliverables/{variantId} (NO shop ID, NO other variations)
      // Based on logs: this is the only structure that works, 404 = no stock (normal)
      endpointVariations.push(
        resourcePath, // products/{id}/deliverables/{variantId} (NO shop ID)
        cleanEndpoint.replace(/^shops\/[^/]+\//, ''), // Remove shop ID if present
      );
      // Don't try other variations - they all return 404
    } else {
      // For other endpoints (products, invoices), try without shop ID first
      endpointVariations.push(
        resourcePath, // products, products/{id}
        resourceType, // Just 'products' or 'invoices'
        cleanEndpoint, // Clean endpoint without shop ID
      );
      
      // If shop ID is available, also try with shop ID (for backwards compatibility)
      if (shopId) {
        endpointVariations.push(
          `shops/${shopId}/${resourcePath}`, // shops/{shopId}/products
          endpoint // Original endpoint as fallback
        );
      }
    }
    
    // Remove duplicates and empty strings
    const uniqueVariations = [...new Set(endpointVariations)].filter(e => e && e.trim() !== '');

    let lastError = null;
    
    // Try each endpoint variation with the official base URL
    for (let i = 0; i < uniqueVariations.length; i++) {
      const endpointVar = uniqueVariations[i];
      
      // Skip if endpoint doesn't make sense for this variation
      if (endpoint.includes('products') && endpointVar.includes('invoices')) continue;
      if (endpoint.includes('invoices') && endpointVar.includes('products')) continue;
      
      try {
        const url = `${this.baseUrl}${endpointVar}`;
        const fullUrl = params && Object.keys(params).length > 0 
          ? `${url}?${new URLSearchParams(params).toString()}`
          : url;
        console.log(`[API GET] [${i + 1}/${uniqueVariations.length}] Trying: ${fullUrl}`);
        console.log(`[API GET] Endpoint: ${endpointVar}`);
        console.log(`[API GET] Headers: Authorization=${this.apiKey.substring(0, 30)}...`);
        
        const response = await axios.get(url, {
          headers: { 
            'Authorization': this.apiKey, // According to docs: without Bearer prefix
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          params: params,
          timeout: 15000,
          validateStatus: (status) => status < 500 // Don't throw on 4xx, we'll handle it
        });

        console.log(`[API GET] Response status: ${response.status}`);
        console.log(`[API GET] Response content-type: ${response.headers['content-type'] || 'unknown'}`);
        console.log(`[API GET] Response size: ${JSON.stringify(response.data || '').length} bytes`);
        
        // Log response data structure
        if (response.data) {
          const dataType = Array.isArray(response.data) ? 'array' : typeof response.data;
          const dataKeys = response.data && typeof response.data === 'object' && !Array.isArray(response.data) 
            ? Object.keys(response.data).join(', ') 
            : 'N/A';
          console.log(`[API GET] Response data type: ${dataType}`);
          if (dataKeys !== 'N/A') {
            console.log(`[API GET] Response data keys: ${dataKeys}`);
          }
          
          // If it's HTML (404 page), log first 200 chars
          if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
            console.log(`[API GET] ⚠️  Received HTML response (404 page): ${response.data.substring(0, 200)}...`);
          } else if (response.data && typeof response.data === 'object') {
            console.log(`[API GET] Response preview:`, JSON.stringify(response.data, null, 2).substring(0, 800));
          }
        }
        
        // If we get a successful response, cache this endpoint structure
        if (response.status === 200 || response.status === 201) {
          if (!this.endpointPrefix && endpointVar !== endpoint) {
            // Extract the prefix that worked
            const prefix = endpointVar.replace(endpoint, '').replace(/\/$/, '');
            this.endpointPrefix = prefix ? `${prefix}/` : '';
            console.log(`[API] ✅ Found working endpoint structure: ${endpointVar}`);
          }
          
          const dataType = Array.isArray(response.data) ? 'array' : typeof response.data;
          const dataSize = Array.isArray(response.data) ? response.data.length : 
                          (response.data?.data && Array.isArray(response.data.data)) ? response.data.data.length :
                          (response.data?.products && Array.isArray(response.data.products)) ? response.data.products.length :
                          'unknown';
          console.log(`[API GET] ✅ Success! Response type: ${dataType}, Size: ${dataSize}`);
          if (dataSize > 0 && dataSize < 10) {
            console.log(`[API GET] Sample data:`, JSON.stringify(response.data, null, 2).substring(0, 500));
          }
          
      return response.data;
        }

        // If 404, try next variation
        if (response.status === 404) {
          console.log(`[API GET] ❌ 404 Not Found`);
          if (response.data) {
            const errorPreview = typeof response.data === 'string' 
              ? response.data.substring(0, 200) 
              : JSON.stringify(response.data, null, 2).substring(0, 200);
            console.log(`[API GET] 404 Response preview: ${errorPreview}...`);
          }
          console.log(`[API GET] ⏭️  Trying next variation...`);
          lastError = { status: 404, data: response.data, message: 'Not found' };
          continue;
        }

        // Other errors, throw
        console.error(`[API GET] ❌ Error status ${response.status}`);
        console.error(`[API GET] Response data:`, JSON.stringify(response.data, null, 2).substring(0, 500));
        throw { 
          message: 'Invalid response', 
          status: response.status, 
          data: response.data, 
          error: `HTTP ${response.status}` 
        };
      } catch (error) {
        const errorStatus = error.response?.status || error.status || 'N/A';
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
        const errorData = error.response?.data || error.data;
        
        console.error(`[API GET] ❌ Error [${i + 1}/${uniqueVariations.length}]: Status ${errorStatus}, Message: ${errorMessage}`);
        if (errorData && typeof errorData === 'object') {
          console.error(`[API GET] Error details:`, JSON.stringify(errorData, null, 2).substring(0, 300));
        }
        
        lastError = {
          status: errorStatus,
          data: errorData,
          message: errorMessage
        };
        
        // Continue to next variation
        console.log(`[API GET] ⏭️  Trying next variation...`);
        continue;
      }
    }
    
    // If we get here, all attempts failed
    console.error(`[API GET] ❌ All ${uniqueVariations.length} attempts failed for: ${endpoint}`);
    console.error(`[API GET] Final error - Status: ${lastError.status}, Message: ${lastError.message}`);
    if (lastError.data) {
      const errorPreview = typeof lastError.data === 'string' 
        ? lastError.data.substring(0, 500)
        : JSON.stringify(lastError.data, null, 2).substring(0, 500);
      console.error(`[API GET] Final error data:`, errorPreview);
    }
    throw { 
      message: 'Invalid response - all endpoint variations failed', 
      status: lastError.status, 
      data: lastError.data, 
      error: lastError.message 
    };
  }

  async post(endpoint, data) {
    // Use cached prefix if available, otherwise try variations
    const endpointVariations = this.endpointPrefix 
      ? [`${this.endpointPrefix}${endpoint}`]
      : [
          endpoint,
          `sellhub/${endpoint}`,
          `v1/${endpoint}`,
          `sellhub/v1/${endpoint}`
        ];

    let lastError = null;
    for (let i = 0; i < endpointVariations.length; i++) {
      try {
        const url = `${this.baseUrl}${endpointVariations[i]}`;
        const response = await axios.post(url, data, {
        headers: {
            'Authorization': this.apiKey,
            'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
          timeout: 10000,
          validateStatus: (status) => status < 500
      });

        if (response.status === 200 || response.status === 201) {
      return response.data;
        }
        if (response.status === 404 && i < endpointVariations.length - 1) {
          continue;
        }
        throw { status: response.status, data: response.data };
    } catch (error) {
        lastError = error;
        if (i === endpointVariations.length - 1) {
          const status = error.response?.status || error.status;
          const respData = error.response?.data || error.data;
      console.error(`[API POST] ${endpoint} - Status: ${status}`, respData);
      throw { message: 'Invalid response', status, data: respData, error: error.message };
        }
      }
    }
  }

  async put(endpoint, data) {
    const endpointVariations = this.endpointPrefix 
      ? [`${this.endpointPrefix}${endpoint}`]
      : [
          endpoint,
          `sellhub/${endpoint}`,
          `v1/${endpoint}`,
          `sellhub/v1/${endpoint}`
        ];

    let lastError = null;
    for (let i = 0; i < endpointVariations.length; i++) {
      try {
        const url = `${this.baseUrl}${endpointVariations[i]}`;
        const response = await axios.put(url, data, {
        headers: {
            'Authorization': this.apiKey,
            'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
          timeout: 10000,
          validateStatus: (status) => status < 500
      });

        if (response.status === 200 || response.status === 201) {
      return response.data;
        }
        if (response.status === 404 && i < endpointVariations.length - 1) {
          continue;
        }
        throw { status: response.status, data: response.data };
    } catch (error) {
        lastError = error;
        if (i === endpointVariations.length - 1) {
          const status = error.response?.status || error.status;
          const respData = error.response?.data || error.data;
      console.error(`[API PUT] ${endpoint} - Status: ${status}`, respData);
      throw { message: 'Invalid response', status, data: respData, error: error.message };
        }
      }
    }
  }

  async delete(endpoint) {
    const endpointVariations = this.endpointPrefix 
      ? [`${this.endpointPrefix}${endpoint}`]
      : [
          endpoint,
          `sellhub/${endpoint}`,
          `v1/${endpoint}`,
          `sellhub/v1/${endpoint}`
        ];

    let lastError = null;
    for (let i = 0; i < endpointVariations.length; i++) {
      try {
        const url = `${this.baseUrl}${endpointVariations[i]}`;
        const response = await axios.delete(url, {
          headers: { 
            'Authorization': this.apiKey,
            'X-API-Key': this.apiKey
          },
          timeout: 10000,
          validateStatus: (status) => status < 500
        });

        if (response.status === 200 || response.status === 201 || response.status === 204) {
      return response.data;
        }
        if (response.status === 404 && i < endpointVariations.length - 1) {
          continue;
        }
        throw { status: response.status, data: response.data };
    } catch (error) {
        lastError = error;
        if (i === endpointVariations.length - 1) {
          const status = error.response?.status || error.status;
          const data = error.response?.data || error.data;
      console.error(`[API DELETE] ${endpoint} - Status: ${status}`, data);
      throw { message: 'Invalid response', status, data, error: error.message };
        }
      }
    }
  }

  async getAllPages(endpoint, maxPerPage = 100, maxPages = 100) {
    try {
      console.log(`[API] Fetching all pages from ${endpoint}`);
      let allItems = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= maxPages) {
        try {
          const response = await this.get(endpoint, { page, perPage: maxPerPage });
          
          // Parse Laravel pagination response
          let pageItems = [];
          if (Array.isArray(response?.data)) {
            pageItems = response.data;
          } else if (Array.isArray(response)) {
            pageItems = response;
          }

          if (pageItems.length === 0) {
            hasMore = false;
            console.log(`[API] Page ${page}: No items (end of results)`);
          } else {
            allItems = allItems.concat(pageItems);
            console.log(`[API] Page ${page}: +${pageItems.length} items (total: ${allItems.length})`);
            
            // Check if there are more pages
            if (response?.next_page_url) {
              page++;
            } else {
              hasMore = false;
            }
          }
        } catch (e) {
          console.error(`[API] Page ${page} error:`, e.message);
          hasMore = false;
        }
      }

      console.log(`[API] Total items fetched: ${allItems.length}`);
      return allItems;
    } catch (error) {
      console.error(`[API] getAllPages error:`, error.message);
      throw error;
    }
  }
}
