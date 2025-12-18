// Version: 2025-11-25T19:07:26.405Z
import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits } from 'discord.js';
import { Bot } from './classes/Bot.js';
import { Api } from './classes/Api.js';
import { config } from './utils/config.js';

// Validate required environment variables (support both SH_* and SA_* for backward compatibility)
const hasApiKey = process.env.SH_API_KEY || process.env.SA_API_KEY;
const hasShopId = process.env.SH_SHOP_ID || process.env.SA_SHOP_ID;
const missingVars = [];
if (!process.env.BOT_TOKEN) missingVars.push('BOT_TOKEN');
if (!process.env.BOT_GUILD_ID) missingVars.push('BOT_GUILD_ID');
if (!hasApiKey) missingVars.push('SH_API_KEY or SA_API_KEY');
if (!hasShopId) missingVars.push('SH_SHOP_ID or SA_SHOP_ID');

if (missingVars.length > 0) {
  console.error(
    `\n❌ ERROR: Missing required environment variables:\n${missingVars.map((v) => `   - ${v}`).join('\n')}\n`
  );
  console.error('Please ensure these variables are set in your environment or .env file');
  process.exit(1);
}

console.log('✅ All environment variables loaded successfully');

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
