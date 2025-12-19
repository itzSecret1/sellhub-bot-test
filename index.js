// Version: 2025-11-25T19:07:26.405Z
import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits } from 'discord.js';
import { Bot } from './classes/Bot.js';
import { Api } from './classes/Api.js';
import { config } from './utils/config.js';

// Validate required environment variables (SellHub ONLY - no SellAuth support)
// IMPORTANT: Only SH_API_KEY is required. SH_SHOP_ID is optional and will be auto-detected.
const missingVars = [];
if (!process.env.BOT_TOKEN) missingVars.push('BOT_TOKEN');
if (!process.env.BOT_GUILD_ID) missingVars.push('BOT_GUILD_ID');
if (!process.env.SH_API_KEY) missingVars.push('SH_API_KEY');
// SH_SHOP_ID is optional - will be obtained from API if not provided

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
