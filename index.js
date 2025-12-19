// Version: 2025-11-25T19:07:26.405Z
import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits } from 'discord.js';
import { Bot } from './classes/Bot.js';
import { Api } from './classes/Api.js';
import { config } from './utils/config.js';

// Validate required environment variables (SellHub ONLY - no SellAuth support)
// IMPORTANT: Only SH_API_KEY is required. SH_SHOP_ID is optional and will be auto-detected.
// Support SA_* variables for migration compatibility (with warning)
const missingVars = [];

// Check both process.env and config (in case of loading order issues)
// Also check for SA_* variables (SellAuth) for backward compatibility
const envVars = {
  BOT_TOKEN: process.env.BOT_TOKEN || config.BOT_TOKEN,
  BOT_GUILD_ID: process.env.BOT_GUILD_ID || config.BOT_GUILD_ID,
  SH_API_KEY: process.env.SH_API_KEY || process.env.SA_API_KEY || config.SH_API_KEY,
  SH_SHOP_ID: process.env.SH_SHOP_ID || process.env.SA_SHOP_ID || config.SH_SHOP_ID // Optional
};

// Check if using deprecated SA_* variables
const usingDeprecatedVars = {
  apiKey: !process.env.SH_API_KEY && !!process.env.SA_API_KEY,
  shopId: !process.env.SH_SHOP_ID && !!process.env.SA_SHOP_ID
};

// Trim whitespace and check if empty
const checkVar = (value, name) => {
  if (!value) return false;
  const trimmed = String(value).trim();
  if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return false;
  return true;
};

// Check each required variable
if (!checkVar(envVars.BOT_TOKEN, 'BOT_TOKEN')) missingVars.push('BOT_TOKEN');
if (!checkVar(envVars.BOT_GUILD_ID, 'BOT_GUILD_ID')) missingVars.push('BOT_GUILD_ID');
if (!checkVar(envVars.SH_API_KEY, 'SH_API_KEY')) missingVars.push('SH_API_KEY');
// SH_SHOP_ID is optional - will be obtained from API if not provided

if (missingVars.length > 0) {
  console.error('\n❌ ERROR: Missing required environment variables:');
  missingVars.forEach(v => {
    console.error(`   - ${v}`);
  });
  console.error('\n📋 Current environment variables status:');
  console.error(`   BOT_TOKEN: ${envVars.BOT_TOKEN ? '✅ Set (' + envVars.BOT_TOKEN.substring(0, 10) + '...)' : '❌ Missing'}`);
  console.error(`   BOT_GUILD_ID: ${envVars.BOT_GUILD_ID ? '✅ Set (' + envVars.BOT_GUILD_ID + ')' : '❌ Missing'}`);
  console.error(`   SH_API_KEY: ${envVars.SH_API_KEY ? '✅ Set (' + envVars.SH_API_KEY.substring(0, 20) + '...)' : '❌ Missing'}`);
  console.error(`   SH_SHOP_ID: ${envVars.SH_SHOP_ID ? '✅ Set (' + envVars.SH_SHOP_ID.substring(0, 20) + '...)' : '⚠️  Optional (will be auto-detected)'}`);
  console.error('\n💡 Please ensure these variables are set in your environment or .env file');
  console.error('   If using Railway, check Settings → Environment → Variables');
  process.exit(1);
}

console.log('✅ All required environment variables loaded successfully');
console.log(`   BOT_TOKEN: ${envVars.BOT_TOKEN ? '✅' : '❌'}`);
console.log(`   BOT_GUILD_ID: ${envVars.BOT_GUILD_ID ? '✅' : '❌'}`);
console.log(`   SH_API_KEY: ${envVars.SH_API_KEY ? '✅ (' + envVars.SH_API_KEY.substring(0, 20) + '...)' : '❌'}`);
console.log(`   SH_SHOP_ID: ${envVars.SH_SHOP_ID ? '✅ (' + envVars.SH_SHOP_ID.substring(0, 20) + '...)' : '⚠️  Optional (will be auto-detected)'}`);

// Warn if using deprecated SA_* variables
if (usingDeprecatedVars.apiKey || usingDeprecatedVars.shopId) {
  console.log('\n⚠️  WARNING: You are using deprecated SA_* variables (SellAuth)');
  if (usingDeprecatedVars.apiKey) {
    console.log('   - Found SA_API_KEY instead of SH_API_KEY');
    console.log('   - Please rename SA_API_KEY to SH_API_KEY in Railway');
  }
  if (usingDeprecatedVars.shopId) {
    console.log('   - Found SA_SHOP_ID instead of SH_SHOP_ID');
    console.log('   - Please rename SA_SHOP_ID to SH_SHOP_ID in Railway (optional)');
  }
  console.log('   - The bot will work, but please migrate to SH_* variables for SellHub');
  console.log('   - Railway: Settings → Environment → Variables → Rename');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

const api = new Api();
const bot = new Bot(client, api);

export { bot, client };
