# 🔧 Solución: Solo Aparecen 3 Comandos

## 📊 Situación Actual

Solo aparecen estos 3 comandos en Discord:
- ✅ `/add-stock`
- ✅ `/analytics`  
- ✅ `/audit`

**Faltan 32 comandos** de un total de 35.

## 🔴 Problema

El bot token actual está **BLOQUEADO por Discord** para registrar más comandos. Esto sucede cuando se intentan registrar demasiados comandos en poco tiempo.

## ✅ Soluciones

### Opción 1: Crear Nuevo Bot Token (RECOMENDADO)

Esta es la solución más rápida y efectiva:

1. **Ve a Discord Developer Portal**
   - URL: https://discord.com/developers/applications
   - Inicia sesión con tu cuenta

2. **Selecciona tu aplicación**
   - O crea una nueva si prefieres

3. **Ve a la sección "Bot"**
   - Click en "Bot" en el menú lateral

4. **Resetea el Token**
   - Click en "Reset Token" o "Regenerate"
   - ⚠️ **COPIA EL NUEVO TOKEN** (solo se muestra una vez)

5. **Actualiza en Railway**
   - Ve a tu proyecto en Railway
   - Settings → Variables
   - Busca `BOT_TOKEN`
   - Reemplaza con el nuevo token
   - Guarda

6. **Reinicia el Bot**
   - Railway se reiniciará automáticamente
   - El bot intentará registrar todos los comandos automáticamente

### Opción 2: Usar Script Manual (Si no hay rate limit)

Si quieres intentar sin crear nuevo token:

```bash
node register-missing-commands.js
```

Este script:
- Detecta qué comandos faltan
- Intenta registrarlos
- Si hay rate limit, te dirá que necesitas nuevo token

### Opción 3: Esperar 24-48 Horas

Si prefieres no crear nuevo token, puedes esperar 24-48 horas y luego:
- Reiniciar el bot
- O ejecutar: `node register-missing-commands.js`

## 📝 Comandos que Deberían Aparecer

Después de crear el nuevo token, deberías ver estos 35 comandos:

### Stock & Productos
- `/stock` - Ver productos y stock
- `/add-stock` - Agregar items al stock ✅ (ya aparece)
- `/delete-stock` - Eliminar items del stock
- `/replace` - Extraer items del stock
- `/unreplace` - Restaurar items
- `/sync-variants` - Sincronizar variantes

### Facturas
- `/invoice-view` - Ver factura
- `/invoice-process` - Procesar factura
- `/claim` - Reclamar factura

### Administración
- `/analytics` - Analytics de ventas ✅ (ya aparece)
- `/audit` - Logs de auditoría ✅ (ya aparece)
- `/stats` - Estadísticas
- `/config` - Configuración
- `/dashboard` - Dashboard
- `/product-status` - Estado de productos

### Balance
- `/balance-add` - Agregar balance
- `/balance-remove` - Remover balance
- `/balances` - Ver balances

### Cupones
- `/coupon-create` - Crear cupón
- `/coupon-delete` - Eliminar cupón
- `/coupon-list` - Listar cupones
- `/coupon-update` - Actualizar cupón
- `/coupon-view` - Ver cupón

### Utilidades
- `/help` - Ayuda
- `/ping` - Ping del bot
- `/clear` - Limpiar mensajes
- `/translate` - Traducir texto
- `/role-info` - Info de roles
- `/status` - Estado del bot

### Backups
- `/backup` - Crear backup
- `/loadbackup` - Cargar backup
- `/listbackup` - Listar backups

### Otros
- `/replace-message` - Reemplazar mensaje
- `/test-deliverables` - Probar deliverables
- `/register-commands` - Registrar comandos (admin)

## 🎯 Recomendación

**Crea un nuevo bot token** - Es la solución más rápida y garantiza que todos los comandos se registren correctamente.

Después de actualizar el token, el bot intentará registrar automáticamente todos los comandos al iniciar.

