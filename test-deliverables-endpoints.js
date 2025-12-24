/**
 * Script para probar diferentes estructuras de endpoints de deliverables
 * según la documentación oficial de SellHub: https://docs.sellhub.cx/api
 */

import 'dotenv/config';
import { Api } from './classes/Api.js';

const api = new Api();

// Ejemplo de IDs de productos y variantes (del log del usuario)
const TEST_CASES = [
  {
    productId: '07ac7b45-32cb-46b1-ac8f-5d833a599c6d',
    variantId: '82e83909-271a-4e43-86eb-19256df94225',
    name: 'betway.co.za'
  },
  {
    productId: 'fac13bb9-51c9-4355-9e09-a0086e7ced99',
    variantId: '43174262-c95f-4832-97b8-232e72eef720',
    name: 'Stake Accounts LVL 2 Verified FA'
  }
];

// Probar diferentes estructuras de endpoints según la documentación
async function testEndpoint(endpoint, description) {
  try {
    console.log(`\n🔍 Probando: ${description}`);
    console.log(`   Endpoint: ${endpoint}`);
    
    const data = await api.get(endpoint);
    
    console.log(`   ✅ ÉXITO!`);
    if (typeof data === 'string') {
      console.log(`   Data (primeros 200 chars): ${data.substring(0, 200)}`);
      console.log(`   Stock count: ${data.split('\n').filter(l => l.trim()).length} items`);
    } else if (Array.isArray(data)) {
      console.log(`   Data type: array, length: ${data.length}`);
      console.log(`   Stock count: ${data.length} items`);
    } else {
      console.log(`   Data keys: ${Object.keys(data || {}).join(', ')}`);
      console.log(`   Data preview: ${JSON.stringify(data, null, 2).substring(0, 500)}`);
    }
    return { success: true, data: data };
  } catch (error) {
    const status = error.status || error.response?.status;
    
    if (status === 404) {
      console.log(`   ❌ 404 Not Found (normal si no hay stock)`);
      return { success: false, status: 404, isNormal: true };
    } else {
      console.log(`   ❌ Error ${status || 'unknown'}: ${error.message}`);
      return { success: false, status: status, error: error.message };
    }
  }
}

async function testAllEndpoints() {
  console.log('='.repeat(80));
  console.log('🧪 PRUEBA DE ENDPOINTS DE DELIVERABLES - SellHub API');
  console.log('='.repeat(80));
  console.log(`API Key: ${api.apiKey.substring(0, 30)}...`);
  
  // Obtener shop ID
  const shopId = await api.getShopId();
  if (shopId) {
    console.log(`Shop ID: ${shopId}`);
  } else {
    console.log(`Shop ID: No detectado (opcional)`);
  }
  
  for (const testCase of TEST_CASES) {
    console.log('\n' + '='.repeat(80));
    console.log(`📦 Producto: ${testCase.name}`);
    console.log(`   Product ID: ${testCase.productId}`);
    console.log(`   Variant ID: ${testCase.variantId}`);
    console.log('='.repeat(80));
    
    const results = [];
    
    // Estructura 1: products/{productId}/deliverables/{variantId} (sin shop ID)
    results.push(await testEndpoint(
      `products/${testCase.productId}/deliverables/${testCase.variantId}`,
      'products/{productId}/deliverables/{variantId} (sin shop ID)'
    ));
    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay entre requests
    
    // Estructura 2: shops/{shopId}/products/{productId}/deliverables/{variantId} (con shop ID)
    if (shopId) {
      results.push(await testEndpoint(
        `shops/${shopId}/products/${testCase.productId}/deliverables/${testCase.variantId}`,
        `shops/{shopId}/products/{productId}/deliverables/{variantId} (con shop ID)`
      ));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Estructura 3: variants/{variantId}/deliverables
    results.push(await testEndpoint(
      `variants/${testCase.variantId}/deliverables`,
      'variants/{variantId}/deliverables'
    ));
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Estructura 4: variants/{variantId}/deliverables?product_id={productId}
    results.push(await testEndpoint(
      `variants/${testCase.variantId}/deliverables?product_id=${testCase.productId}`,
      'variants/{variantId}/deliverables?product_id={productId}'
    ));
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Estructura 5: deliverables/{variantId}
    results.push(await testEndpoint(
      `deliverables/${testCase.variantId}`,
      'deliverables/{variantId}'
    ));
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Estructura 6: deliverables/{variantId}?product_id={productId}
    results.push(await testEndpoint(
      `deliverables/${testCase.variantId}?product_id=${testCase.productId}`,
      'deliverables/{variantId}?product_id={productId}'
    ));
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Resumen
    const successCount = results.filter(r => r.success).length;
    console.log(`\n📊 Resumen: ${successCount}/${results.length} endpoints funcionaron`);
    
    if (successCount === 0) {
      console.log('⚠️ Ningún endpoint funcionó. Esto puede significar:');
      console.log('   1. El variant no tiene stock (404 es normal)');
      console.log('   2. La estructura del endpoint es diferente');
      console.log('   3. Se requiere autenticación adicional');
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Prueba completada');
  console.log('='.repeat(80));
}

// Ejecutar pruebas
testAllEndpoints().catch(console.error);

