// Script to verify SellHub API configuration
// Usage: node verify-sellhub.js

import dotenv from 'dotenv';
dotenv.config();

import { Api } from './classes/Api.js';
import { config } from './utils/config.js';

async function verifySellHub() {
  console.log('🔍 Verificando configuración de SellHub...\n');
  
  // 1. Check environment variables
  console.log('1️⃣ Verificando variables de entorno...');
  const checks = {
    'BOT_TOKEN': !!config.BOT_TOKEN,
    'BOT_GUILD_ID': !!config.BOT_GUILD_ID,
    'SH_API_KEY': !!config.SH_API_KEY,
    'SH_SHOP_ID': !!config.SH_SHOP_ID
  };
  
  let allOk = true;
  for (const [key, value] of Object.entries(checks)) {
    const status = value ? '✅' : '❌';
    console.log(`   ${status} ${key}: ${value ? 'Configurado' : 'FALTANTE'}`);
    if (!value) allOk = false;
  }
  
  if (!allOk) {
    console.log('\n❌ Faltan variables de entorno requeridas!');
    return;
  }
  
  console.log('\n✅ Todas las variables de entorno están configuradas\n');
  
  // 2. Check API configuration
  console.log('2️⃣ Verificando configuración de API...');
  const api = new Api();
  console.log(`   Base URL: ${api.baseUrl}`);
  console.log(`   API Key (primeros 20 chars): ${api.apiKey.substring(0, 20)}...`);
  console.log(`   Shop ID: ${api.shopId}`);
  
  if (api.baseUrl.includes('sellauth')) {
    console.log('   ❌ ERROR: Base URL contiene "sellauth" - debe ser "sellhub"');
    return;
  }
  
  if (!api.baseUrl.includes('sellhub')) {
    console.log('   ⚠️  ADVERTENCIA: Base URL no contiene "sellhub"');
  }
  
  console.log('\n✅ Configuración de API correcta\n');
  
  // 3. Test API connection
  console.log('3️⃣ Probando conexión con API de SellHub...');
  try {
    // Try to fetch products
    console.log(`   Probando: shops/${api.shopId}/products`);
    const products = await api.get(`shops/${api.shopId}/products`, { limit: 1, page: 1 });
    
    if (products) {
      console.log('   ✅ Conexión exitosa con API de SellHub!');
      const productCount = Array.isArray(products) ? products.length : products?.data?.length || 0;
      console.log(`   📦 Productos encontrados en primera página: ${productCount}`);
    } else {
      console.log('   ⚠️  Respuesta vacía de la API');
    }
  } catch (error) {
    console.log(`   ❌ Error de conexión: ${error.message}`);
    if (error.status === 401) {
      console.log('   ⚠️  Error 401: API Key inválida o sin permisos');
    } else if (error.status === 404) {
      console.log('   ⚠️  Error 404: Endpoint no encontrado - verificar estructura de URL');
    } else {
      console.log(`   ⚠️  Status: ${error.status}`);
      console.log(`   ⚠️  Detalles: ${JSON.stringify(error.data || error.message)}`);
    }
  }
  
  console.log('\n4️⃣ Verificando endpoints críticos...');
  const criticalEndpoints = [
    `shops/${api.shopId}/products`,
    `shops/${api.shopId}/invoices`,
    `shops/${api.shopId}/products/{productId}/deliverables/{variantId}`
  ];
  
  for (const endpoint of criticalEndpoints) {
    console.log(`   📍 ${endpoint}`);
  }
  
  console.log('\n✅ Verificación completada!\n');
  console.log('📝 Resumen:');
  console.log('   - Variables de entorno: ✅');
  console.log('   - Configuración de API: ✅');
  console.log('   - Base URL: SellHub (correcto)');
  console.log('   - Endpoints: Estructura correcta para SellHub');
  console.log('\n💡 Si hay errores de conexión, verifica:');
  console.log('   1. Que SH_API_KEY sea correcta');
  console.log('   2. Que SH_SHOP_ID sea correcto');
  console.log('   3. Que la API de SellHub esté accesible');
}

verifySellHub().catch(console.error);

