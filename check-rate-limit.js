// Script to check if bot is rate limited by Discord
// Usage: node check-rate-limit.js

import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const GUILD_ID = process.env.BOT_GUILD_ID || '';

if (!BOT_TOKEN || !GUILD_ID) {
  console.error('❌ Missing BOT_TOKEN or BOT_GUILD_ID');
  process.exit(1);
}

async function checkRateLimit() {
  try {
    console.log('🔍 Checking Discord rate limit status...\n');
    
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(BOT_TOKEN);
    const clientId = client.user.id;
    console.log(`✅ Bot connected: ${client.user.username} (${clientId})\n`);
    
    // Try to fetch existing commands (this doesn't count as registration)
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    const existing = await rest.get(Routes.applicationGuildCommands(clientId, GUILD_ID));
    console.log(`📊 Currently registered: ${existing.length} commands\n`);
    
    // Try to register a test command to check rate limit
    console.log('🧪 Testing command registration (will delete immediately)...');
    
    const testCommand = {
      name: 'test-rate-limit-check',
      description: 'Temporary test command'
    };
    
    try {
      const created = await rest.post(
        Routes.applicationGuildCommands(clientId, GUILD_ID),
        { body: testCommand }
      );
      
      console.log('✅ Registration test SUCCESSFUL - No rate limit detected!\n');
      
      // Delete the test command immediately
      await rest.delete(Routes.applicationGuildCommand(clientId, GUILD_ID, created.id));
      console.log('🧹 Test command deleted\n');
      
      console.log('✅ RESULT: You can register commands now!');
      console.log('💡 Run: node register-commands.js\n');
      
    } catch (error) {
      if (error.code === 30034) {
        console.log('❌ RATE LIMIT DETECTED!\n');
        console.log('⚠️  Discord is blocking command registration for this bot.');
        console.log('⏰ This can last from a few hours to several days.\n');
        console.log('💡 SOLUTIONS:');
        console.log('   1. Wait 24-48 hours and try again');
        console.log('   2. Create a NEW bot in Discord Developer Portal');
        console.log('   3. Use the new bot token in your .env file');
        console.log('   4. Run: node register-commands.js\n');
      } else if (error.code === 50001) {
        console.log('❌ MISSING PERMISSIONS!\n');
        console.log('⚠️  Bot needs "applications.commands" scope');
        console.log('💡 Add it in Discord Developer Portal > OAuth2 > URL Generator\n');
      } else {
        console.log(`❌ Error: ${error.message} (Code: ${error.code})\n`);
      }
      
      console.log('❌ RESULT: Cannot register commands right now\n');
    }
    
    await client.destroy();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 50001) {
      console.error('   Missing permissions - Bot needs applications.commands scope');
    }
    process.exit(1);
  }
}

checkRateLimit();

