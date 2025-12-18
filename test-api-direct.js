import 'dotenv/config';
import axios from 'axios';

const apiKey = process.env.SH_API_KEY || process.env.SA_API_KEY || '';
const shopId = process.env.SH_SHOP_ID || process.env.SA_SHOP_ID || '';

console.log('🔍 Testing SellHub API directly...\n');
console.log(`Shop ID: ${shopId}`);
console.log(`API Key (first 30 chars): ${apiKey.substring(0, 30)}...\n`);

// Test the exact structure from docs: https://dash.sellhub.cx/api/sellhub/...
const testUrls = [
  // From official docs
  `https://dash.sellhub.cx/api/sellhub/shops/${shopId}/products`,
  `https://dash.sellhub.cx/api/sellhub/products`,
  `https://dash.sellhub.cx/api/sellhub/customers`, // Test with customers endpoint from docs
  
  // Direct domain (no /api/)
  `https://snakessh.sellhub.cx/${shopId}/products`,
  `https://snakessh.sellhub.cx/products`,
  
  // API subdomain
  `https://api.sellhub.cx/shops/${shopId}/products`,
  `https://api.sellhub.cx/products`,
];

async function testUrl(url) {
  console.log(`\n📡 Testing: ${url}`);
  
  const headers = {
    'Authorization': apiKey,
    'X-API-Key': apiKey,
    'Accept': 'application/json'
  };
  
  try {
    const response = await axios.get(url, {
      headers: headers,
      timeout: 10000,
      validateStatus: () => true // Don't throw on any status
    });
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);
    
    if (response.status === 200 || response.status === 201) {
      console.log(`   ✅ SUCCESS!`);
      if (response.data) {
        const dataType = Array.isArray(response.data) ? 'array' : typeof response.data;
        const dataSize = Array.isArray(response.data) ? response.data.length : 
                        (response.data?.data && Array.isArray(response.data.data)) ? response.data.data.length : 'unknown';
        console.log(`   Data type: ${dataType}, Size: ${dataSize}`);
        console.log(`   Response preview:`, JSON.stringify(response.data, null, 2).substring(0, 500));
      }
      return true;
    } else if (response.status === 401) {
      console.log(`   ❌ 401 Unauthorized - API key may be invalid`);
    } else if (response.status === 404) {
      console.log(`   ❌ 404 Not Found`);
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
        console.log(`   ⚠️  Received HTML (404 page)`);
      }
    } else {
      console.log(`   ❌ Error ${response.status}`);
      if (response.data) {
        console.log(`   Response:`, JSON.stringify(response.data, null, 2).substring(0, 300));
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
    }
  }
  
  return false;
}

async function runTests() {
  for (const url of testUrls) {
    const success = await testUrl(url);
    if (success) {
      console.log(`\n✅ Found working URL: ${url}`);
      break;
    }
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`\n📝 Test complete.`);
}

runTests().catch(console.error);

