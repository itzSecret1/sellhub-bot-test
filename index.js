// Version: 2025-11-25T19:07:26.405Z
import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits } from 'discord.js';
import { Bot } from './classes/Bot.js';
import { Api } from './classes/Api.js';
import { config } from './utils/config.js';

// Validate required environment variables
// IMPORTANT: Only API Key is required. Shop ID is optional and will be auto-detected.
// Automatically uses SA_* variables if SH_* are not available (transparent compatibility)
const missingVars = [];

// Check both process.env and config (in case of loading order issues)
// Automatically fallback to SA_* if SH_* not available (transparent migration)
const envVars = {
  BOT_TOKEN: process.env.BOT_TOKEN || config.BOT_TOKEN,
  BOT_GUILD_ID: process.env.BOT_GUILD_ID || config.BOT_GUILD_ID,
  SH_API_KEY: process.env.SH_API_KEY || process.env.SA_API_KEY || config.SH_API_KEY,
  SH_SHOP_ID: process.env.SH_SHOP_ID || process.env.SA_SHOP_ID || config.SH_SHOP_ID // Optional
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
console.log(`   API_KEY: ${envVars.SH_API_KEY ? '✅ (' + envVars.SH_API_KEY.substring(0, 20) + '...)' : '❌'}`);
console.log(`   SHOP_ID: ${envVars.SH_SHOP_ID ? '✅ (' + envVars.SH_SHOP_ID.substring(0, 20) + '...)' : '⚠️  Optional (will be auto-detected)'}`);

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
