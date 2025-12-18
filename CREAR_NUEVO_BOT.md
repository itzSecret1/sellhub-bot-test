# 🔴 SOLUCIÓN: Crear Nuevo Bot Token

El bot actual está **BLOQUEADO por Discord** para registrar comandos. Necesitas crear un **NUEVO bot token**.

## 📋 Pasos para Crear Nuevo Bot

### 1. Ve a Discord Developer Portal
Abre: https://discord.com/developers/applications

### 2. Opción A: Usar Aplicación Existente
- Selecciona tu aplicación existente
- Ve a la sección **"Bot"** (lado izquierdo)
- Haz click en **"Reset Token"** o **"Regenerate"**
- ⚠️ **COPIA EL NUEVO TOKEN** (solo se muestra una vez)

### 2. Opción B: Crear Nueva Aplicación
- Click en **"New Application"**
- Dale un nombre (ej: "SellHub Bot 2")
- Ve a **"Bot"** → **"Add Bot"**
- Click en **"Reset Token"**
- ⚠️ **COPIA EL TOKEN** (solo se muestra una vez)

### 3. Configurar Permisos del Bot
En la sección **"Bot"**:
- ✅ Activa **"Message Content Intent"** (si no está activado)
- ✅ Activa **"Server Members Intent"** (si no está activado)

### 4. Invitar Bot al Servidor
1. Ve a **"OAuth2"** → **"URL Generator"**
2. Selecciona scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Selecciona permisos:
   - ✅ `Send Messages`
   - ✅ `Manage Messages`
   - ✅ `Read Message History`
   - ✅ `Use Slash Commands`
4. Copia la URL generada
5. Abre la URL en tu navegador
6. Selecciona tu servidor y autoriza

### 5. Actualizar Token en Railway
1. Ve a tu proyecto en Railway
2. Click en **"Settings"** → **"Variables"**
3. Busca `BOT_TOKEN`
4. Reemplaza el valor con el **NUEVO TOKEN**
5. Click en **"Save"**
6. El bot se reiniciará automáticamente

### 6. Verificar
Después de reiniciar, el bot intentará registrar comandos automáticamente. Deberías ver:
```
[BOT] ✅ Successfully registered 35 commands via REST API!
```

## ⚠️ Importante

- **NO compartas el token** con nadie
- **NO lo subas a GitHub** (debe estar en `.env` o Railway variables)
- Si pierdes el token, puedes regenerarlo desde Discord Developer Portal

## 🔍 Verificar Rate Limit

Si quieres verificar si el nuevo token funciona:
```bash
node check-rate-limit.js
```

Debería mostrar: `✅ Registration test SUCCESSFUL - No rate limit detected!`

