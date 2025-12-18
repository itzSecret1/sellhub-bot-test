import axios from 'axios';
import { config } from '../utils/config.js';

export class Api {
  constructor() {
    // Base URL according to official docs: https://dash.sellhub.cx/api/sellhub/
    this.baseUrl = 'https://dash.sellhub.cx/api/sellhub/';
    this.apiKey = config.SH_API_KEY;
    this.shopId = config.SH_SHOP_ID;
    this.endpointPrefix = ''; // Will be determined dynamically
  }

  async get(endpoint, params = {}) {
    // According to official docs: https://dash.sellhub.cx/api/sellhub/{recurso}
    // Examples: /api/sellhub/customers, /api/sellhub/products
    
    // Extract resource type from endpoint
    // Endpoints come as: shops/{shopId}/products -> extract 'products'
    // Or: shops/{shopId}/products/{productId}/deliverables/{variantId} -> extract 'deliverables'
    let resourceType = '';
    let resourcePath = '';
    
    if (endpoint.includes('/deliverables/')) {
      // For deliverables: shops/{shopId}/products/{productId}/deliverables/{variantId}
      // Convert to: products/{productId}/deliverables/{variantId}
      resourcePath = endpoint.replace(`shops/${this.shopId}/`, '');
      resourceType = 'deliverables';
    } else if (endpoint.includes('/products/')) {
      // For specific product: shops/{shopId}/products/{productId}
      // Convert to: products/{productId}
      resourcePath = endpoint.replace(`shops/${this.shopId}/`, '');
      resourceType = 'products';
    } else if (endpoint.includes('products')) {
      resourceType = 'products';
      resourcePath = 'products';
    } else if (endpoint.includes('invoices')) {
      resourceType = 'invoices';
      resourcePath = 'invoices';
    } else {
      // Fallback: try to extract resource type
      const parts = endpoint.split('/');
      resourceType = parts[parts.length - 1] || endpoint;
      resourcePath = endpoint.replace(`shops/${this.shopId}/`, '');
    }
    
    // Build endpoint variations according to docs
    const endpointVariations = [
      resourcePath, // products, products/{id}, products/{id}/deliverables/{variantId}
      resourceType, // Just 'products' or 'invoices'
      endpoint.replace(`shops/${this.shopId}/`, ''), // Remove shop ID prefix
      endpoint // Original endpoint as fallback
    ];
    
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
