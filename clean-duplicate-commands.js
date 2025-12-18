// Script to clean duplicate commands
// Usage: node clean-duplicate-commands.js

import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const GUILD_ID = process.env.BOT_GUILD_ID || '';

if (!BOT_TOKEN || !GUILD_ID) {
  console.error('❌ Missing BOT_TOKEN or BOT_GUILD_ID');
  process.exit(1);
}

async function cleanDuplicates() {
  try {
    console.log('🔍 Conectando con Discord...\n');
    
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(BOT_TOKEN);
    const clientId = client.user.id;
    console.log(`✅ Bot: ${client.user.username} (${clientId})\n`);
    
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    
    // Get all registered commands
    console.log('📋 Obteniendo comandos registrados...');
    const commands = await rest.get(Routes.applicationGuildCommands(clientId, GUILD_ID));
    console.log(`✅ Encontrados ${commands.length} comandos\n`);
    
    // Find duplicates by name
    const commandMap = new Map();
    const duplicates = [];
    
    for (const cmd of commands) {
      if (commandMap.has(cmd.name)) {
        duplicates.push(cmd);
        console.log(`⚠️  Duplicado encontrado: /${cmd.name} (ID: ${cmd.id})`);
      } else {
        commandMap.set(cmd.name, cmd);
      }
    }
    
    if (duplicates.length === 0) {
      console.log('✅ No se encontraron comandos duplicados!\n');
      await client.destroy();
      return;
    }
    
    console.log(`\n🗑️  Eliminando ${duplicates.length} comandos duplicados...\n`);
    
    // Delete duplicates
    let deleted = 0;
    for (const dup of duplicates) {
      try {
        await rest.delete(Routes.applicationGuildCommand(clientId, GUILD_ID, dup.id));
        console.log(`✅ Eliminado: /${dup.name} (ID: ${dup.id})`);
        deleted++;
        await new Promise(r => setTimeout(r, 200)); // Rate limit protection
      } catch (error) {
        console.error(`❌ Error eliminando /${dup.name}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Eliminados ${deleted}/${duplicates.length} comandos duplicados`);
    
    // Verify final state
    const final = await rest.get(Routes.applicationGuildCommands(clientId, GUILD_ID));
    console.log(`\n📊 Comandos finales: ${final.length}`);
    console.log(`📝 Comandos únicos: ${new Set(final.map(c => c.name)).size}\n`);
    
    await client.destroy();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error(`   Código: ${error.code}`);
    }
    process.exit(1);
  }
}

cleanDuplicates();

