// Script to manually register Discord slash commands
// Run this when you need to register/update commands
// Usage: node register-commands.js

import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const GUILD_ID = process.env.BOT_GUILD_ID || '';

if (!BOT_TOKEN || !GUILD_ID) {
  console.error('❌ Missing BOT_TOKEN or BOT_GUILD_ID in environment variables');
  process.exit(1);
}

async function loadCommands() {
  const commands = [];
  const commandFiles = readdirSync(join(__dirname, 'commands'))
    .filter((file) => file.endsWith('.js') && !file.endsWith('.map'));

  for (const file of commandFiles) {
    try {
      const commandPath = pathToFileURL(join(__dirname, 'commands', `${file}`)).href;
      const command = await import(commandPath);
      if (command.default && command.default.data) {
        commands.push(command.default.data.toJSON());
        console.log(`✅ Loaded: ${command.default.data.name}`);
      }
    } catch (err) {
      console.error(`❌ Error loading ${file}:`, err.message);
    }
  }

  return commands;
}

async function registerCommands() {
  try {
    console.log('📋 Loading commands...');
    const commands = await loadCommands();
    
    if (commands.length === 0) {
      console.error('❌ No commands found!');
      return;
    }

    console.log(`\n📦 Found ${commands.length} commands to register\n`);

    // Get client ID from bot
    console.log('🔍 Fetching client ID from Discord...');
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(BOT_TOKEN);
    const clientId = client.user.id;
    console.log(`✅ Client ID: ${clientId}\n`);
    await client.destroy();

    // Create REST client
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

    console.log(`🚀 Registering ${commands.length} commands to guild ${GUILD_ID}...\n`);

    // Register commands
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, GUILD_ID),
      { body: commands }
    );

    console.log(`\n✅ Successfully registered ${data.length} commands!`);
    console.log(`\n📝 Registered commands:`);
    data.forEach((cmd, i) => {
      console.log(`   ${i + 1}. /${cmd.name}`);
    });
    console.log(`\n✨ Commands should appear in Discord within a few minutes!\n`);

  } catch (error) {
    console.error('\n❌ Error registering commands:');
    
    if (error.code === 50001) {
      console.error('   Missing Access - Bot needs "applications.commands" scope!');
      console.error('   Add the scope in Discord Developer Portal > OAuth2 > URL Generator');
    } else if (error.code === 50025) {
      console.error('   Invalid Form Body - Check command structure!');
    } else if (error.code === 10004) {
      console.error('   Unknown Guild - Check BOT_GUILD_ID!');
    } else if (error.code === 30034) {
      console.error('   Rate Limit - Too many commands registered recently!');
      console.error('   Wait a few hours or create a new bot token.');
    } else {
      console.error(`   Code: ${error.code}`);
      console.error(`   Message: ${error.message}`);
      if (error.rawError) {
        console.error(`   Details:`, error.rawError);
      }
    }
    
    process.exit(1);
  }
}

// Run registration
registerCommands();
