import axios from 'axios';
import { config } from '../utils/config.js';

export class Api {
  constructor() {
    // Base URL - try without /v1/ first, then fallback
    this.baseUrl = 'https://snakessh.sellhub.cx/api/';
    this.apiKey = config.SH_API_KEY;
    this.shopId = config.SH_SHOP_ID;
    this.endpointPrefix = ''; // Will be determined dynamically
  }

  async get(endpoint, params = {}) {
    // Based on SellHub docs and dashboard URL structure
    // Dashboard: https://dash.sellhub.cx/{shopId}/products/...
    // Try multiple endpoint structures and base URLs
    // First, try different base URLs (prioritize dash.sellhub.cx based on docs)
    const baseUrls = [
      `https://snakessh.sellhub.cx/api/${this.shopId}/`, // Shop-specific API (most likely)
      `https://dash.sellhub.cx/api/${this.shopId}/`, // Shop-specific API on dash
      `https://dash.sellhub.cx/api/sellhub/`, // From official docs
      `https://dash.sellhub.cx/api/`, // From official docs
      `https://snakessh.sellhub.cx/api/`,
      `https://api.sellhub.cx/`,
      `https://api.sellhub.cx/v1/`,
      `https://snakessh.sellhub.cx/`
    ];
    
    // Extract resource type from endpoint (products, invoices, etc.)
    const resourceType = endpoint.includes('products') ? 'products' : 
                        endpoint.includes('invoices') ? 'invoices' :
                        endpoint.includes('deliverables') ? 'deliverables' : '';
    
    // Then try different endpoint structures (prioritize simple resource names)
    const endpointVariations = [
      resourceType, // Just products (if shop ID is in base URL)
      `shops/${this.shopId}/${resourceType}`, // shops/{shopId}/products
      `sellhub/shops/${this.shopId}/${resourceType}`, // From docs: sellhub/shops/{shopId}/products
      `sellhub/${resourceType}`, // sellhub/products
      endpoint, // Original: shops/{shopId}/products
      `sellhub/${endpoint}`, // sellhub/shops/{shopId}/products
      `${this.shopId}/${resourceType}`, // shopId/products
      `v1/${resourceType}`, // v1/products
      `v1/shops/${this.shopId}/${resourceType}`, // v1/shops/{shopId}/products
      `api/sellhub/shops/${this.shopId}/${resourceType}`, // api/sellhub/shops/{shopId}/products
      `api/v1/shops/${this.shopId}/${resourceType}` // api/v1/shops/{shopId}/products
    ];

    let lastError = null;
    let attemptCount = 0;
    const maxAttempts = baseUrls.length * endpointVariations.length;
    
    // Try each base URL with each endpoint variation
    for (const baseUrl of baseUrls) {
      for (let i = 0; i < endpointVariations.length; i++) {
        const endpointVar = endpointVariations[i];
        attemptCount++;
        
        // Skip if endpoint doesn't make sense for this variation
        if (endpoint.includes('products') && endpointVar.includes('invoices')) continue;
        if (endpoint.includes('invoices') && endpointVar.includes('products')) continue;
        if (endpoint.includes('deliverables') && !endpointVar.includes('deliverables') && resourceType === 'deliverables') continue;
        
        try {
          const url = `${baseUrl}${endpointVar}`;
          const fullUrl = params && Object.keys(params).length > 0 
            ? `${url}?${new URLSearchParams(params).toString()}`
            : url;
          console.log(`[API GET] [${attemptCount}/${maxAttempts}] Trying: ${fullUrl}`);
          console.log(`[API GET] Base: ${baseUrl}, Endpoint: ${endpointVar}`);
          console.log(`[API GET] Headers: Authorization=${this.apiKey.substring(0, 20)}..., X-API-Key=${this.apiKey.substring(0, 20)}...`);
          
          const response = await axios.get(url, {
            headers: { 
              'Authorization': this.apiKey, // According to docs: without Bearer prefix
              'X-API-Key': this.apiKey,
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
        
        // If we get a successful response, cache this endpoint structure and base URL
        if (response.status === 200 || response.status === 201) {
          // Cache the working base URL
          if (baseUrl !== this.baseUrl) {
            this.baseUrl = baseUrl;
            console.log(`[API] ✅ Found working base URL: ${baseUrl}`);
          }
          
          if (!this.endpointPrefix && endpointVar !== endpoint) {
            // Extract the prefix that worked
            const prefix = endpointVar.replace(endpoint, '').replace(/\/$/, '');
            this.endpointPrefix = prefix ? `${prefix}/` : '';
            console.log(`[API] ✅ Found working endpoint prefix: ${this.endpointPrefix || 'none'}`);
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
        
        console.error(`[API GET] ❌ Error [${attemptCount}/${maxAttempts}]: Status ${errorStatus}, Message: ${errorMessage}`);
        if (errorData && typeof errorData === 'object') {
          console.error(`[API GET] Error details:`, JSON.stringify(errorData, null, 2).substring(0, 300));
        }
        
        lastError = {
          status: errorStatus,
          data: errorData,
          message: errorMessage
        };
        
        // Continue to next variation (will continue inner loop, then outer loop)
        console.log(`[API GET] ⏭️  Trying next variation...`);
        continue;
      }
      } // End inner loop (endpointVariations)
    } // End outer loop (baseUrls)
    
    // If we get here, all attempts failed
    console.error(`[API GET] ❌ All ${maxAttempts} attempts failed for: ${endpoint}`);
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
