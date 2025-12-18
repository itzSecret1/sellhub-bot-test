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
    // Try multiple endpoint structures
    const endpointVariations = [
      endpoint, // Original
      `sellhub/${endpoint}`, // With sellhub prefix
      `v1/${endpoint}`, // With v1 prefix
      `sellhub/v1/${endpoint}` // With both prefixes
    ];

    for (const endpointVar of endpointVariations) {
      try {
        const url = `${this.baseUrl}${endpointVar}`;
        console.log(`[API GET] Trying: ${url}`);
        
        const response = await axios.get(url, {
          headers: { 
            'Authorization': this.apiKey,
            'X-API-Key': this.apiKey
          },
          params: params,
          timeout: 15000,
          validateStatus: (status) => status < 500 // Don't throw on 4xx, we'll handle it
        });

        // If we get a successful response, cache this endpoint structure
        if (response.status === 200 || response.status === 201) {
          if (!this.endpointPrefix && endpointVar !== endpoint) {
            // Extract the prefix that worked
            const prefix = endpointVar.replace(endpoint, '').replace(/\/$/, '');
            this.endpointPrefix = prefix ? `${prefix}/` : '';
            console.log(`[API] Found working endpoint prefix: ${this.endpointPrefix || 'none'}`);
          }
          return response.data;
        }

        // If 404, try next variation
        if (response.status === 404) {
          continue;
        }

        // Other errors, throw
        throw { 
          message: 'Invalid response', 
          status: response.status, 
          data: response.data, 
          error: `HTTP ${response.status}` 
        };
      } catch (error) {
        // If it's the last variation, throw the error
        if (endpointVar === endpointVariations[endpointVariations.length - 1]) {
          const status = error.response?.status || error.status;
          const data = error.response?.data || error.data;
          console.error(`[API GET] All variations failed for: ${endpoint}`);
          console.error(`[API GET] Last error - Status: ${status}`, data);
          throw { 
            message: 'Invalid response', 
            status, 
            data, 
            error: error.message || error.error 
          };
        }
        // Otherwise, continue to next variation
        continue;
      }
    }
  }

  async post(endpoint, data) {
    try {
      const response = await axios.post(`${this.baseUrl}${endpoint}`, data, {
        headers: {
          'Authorization': this.apiKey,
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const respData = error.response?.data;
      console.error(`[API POST] ${endpoint} - Status: ${status}`, respData);
      throw { message: 'Invalid response', status, data: respData, error: error.message };
    }
  }

  async put(endpoint, data) {
    try {
      const response = await axios.put(`${this.baseUrl}${endpoint}`, data, {
        headers: {
          'Authorization': this.apiKey,
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const respData = error.response?.data;
      console.error(`[API PUT] ${endpoint} - Status: ${status}`, respData);
      throw { message: 'Invalid response', status, data: respData, error: error.message };
    }
  }

  async delete(endpoint) {
    try {
      const response = await axios.delete(`${this.baseUrl}${endpoint}`, {
        headers: { 
          'Authorization': this.apiKey,
          'X-API-Key': this.apiKey
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      console.error(`[API DELETE] ${endpoint} - Status: ${status}`, data);
      throw { message: 'Invalid response', status, data, error: error.message };
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
