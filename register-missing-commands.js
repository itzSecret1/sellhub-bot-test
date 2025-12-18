// Script to register ONLY missing commands
// This tries to register commands that are not already registered
// Usage: node register-missing-commands.js

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
  console.error('❌ Missing BOT_TOKEN or BOT_GUILD_ID');
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
      }
    } catch (err) {
      console.error(`❌ Error loading ${file}:`, err.message);
    }
  }

  return commands;
}

async function registerMissingCommands() {
  try {
    console.log('🔍 Conectando con Discord...\n');
    
    // Get client ID
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(BOT_TOKEN);
    const clientId = client.user.id;
    console.log(`✅ Bot: ${client.user.username} (${clientId})\n`);
    
    // Get currently registered commands
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    const registered = await rest.get(Routes.applicationGuildCommands(clientId, GUILD_ID));
    const registeredNames = new Set(registered.map(cmd => cmd.name));
    
    console.log(`📊 Comandos actualmente registrados: ${registered.length}`);
    console.log(`   ${Array.from(registeredNames).join(', ')}\n`);
    
    // Load all commands
    console.log('📋 Cargando todos los comandos...');
    const allCommands = await loadCommands();
    console.log(`✅ Cargados ${allCommands.length} comandos\n`);
    
    // Filter out already registered commands
    const missingCommands = allCommands.filter(cmd => !registeredNames.has(cmd.name));
    
    if (missingCommands.length === 0) {
      console.log('✅ ¡Todos los comandos ya están registrados!\n');
      await client.destroy();
      return;
    }
    
    console.log(`⚠️  Comandos faltantes: ${missingCommands.length}`);
    console.log(`   ${missingCommands.map(c => c.name).join(', ')}\n`);
    
    // Try to register missing commands
    console.log('🚀 Intentando registrar comandos faltantes...\n');
    
    try {
      // Register ALL commands (Discord will update existing ones)
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, GUILD_ID),
        { body: allCommands }
      );
      
      console.log(`\n✅ ¡Éxito! Registrados ${data.length} comandos`);
      console.log(`\n📝 Comandos registrados:`);
      data.forEach((cmd, i) => {
        const wasNew = !registeredNames.has(cmd.name);
        const marker = wasNew ? '🆕' : '✅';
        console.log(`   ${marker} ${i + 1}. /${cmd.name}`);
      });
      console.log(`\n✨ Los comandos deberían aparecer en Discord en unos minutos!\n`);
      
    } catch (error) {
      if (error.code === 30034) {
        console.error('\n❌ RATE LIMIT: Discord está bloqueando el registro');
        console.error('💡 SOLUCIÓN: Necesitas crear un NUEVO bot token\n');
        console.error('📋 Pasos:');
        console.error('   1. Ve a: https://discord.com/developers/applications');
        console.error('   2. Selecciona tu aplicación');
        console.error('   3. Ve a "Bot" → "Reset Token"');
        console.error('   4. Copia el NUEVO token');
        console.error('   5. En Railway: Settings → Variables → Actualiza BOT_TOKEN');
        console.error('   6. Reinicia el bot\n');
      } else {
        console.error(`\n❌ Error: ${error.message}`);
        if (error.code) console.error(`   Código: ${error.code}`);
      }
    }
    
    await client.destroy();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

registerMissingCommands();

