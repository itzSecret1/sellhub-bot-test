# 📋 Cómo Interpretar los Logs de Railway

## ✅ Logs de Éxito (Todo Funcionando)

Si ves estos mensajes, **todo está bien**:

```
✅ All environment variables loaded successfully
[BOT LOGIN] Connecting to Discord... (Safe attempt)
[CONNECTION] ✅ Successfully connected
Snake Support 2 ready!
[BOT] ✅ Loaded 35 commands into memory
[BOT] 📊 Currently registered: X commands
[BOT] ⚠️  Only X commands registered (expected ~35)
[BOT] 🔄 Attempting to register missing commands...
[BOT] 🚀 Attempting to register 35 commands...
[BOT] ✅ Successfully registered 35 commands via REST API!
[BOT] 📝 Commands: add-stock, analytics, audit, backup, ...
```

**Esto significa:** ✅ Todos los comandos se registraron correctamente

---

## ⚠️ Logs con Rate Limit

Si ves esto, el token aún está bloqueado:

```
[BOT] ❌ RATE LIMIT: Still blocked - wait 24-48 hours
```

**Solución:** Espera 24-48 horas o crea otro bot token

---

## ⚠️ Logs con Timeout

Si ves esto, hay un problema de conexión:

```
[BOT] ⚠️  REST API failed: REST API timeout (20s)
[BOT] 🔄 Falling back to individual registration...
[BOT] ❌ [1/35] Failed: add-stock - Command registration timeout (10s)
```

**Solución:** El token puede estar bloqueado, intenta crear otro bot token

---

## ✅ Logs Parciales (Algunos Comandos)

Si ves esto, algunos comandos se registraron:

```
[BOT] ✅ Successfully registered 25 commands via REST API!
[BOT] ⚠️  10 commands failed to register
```

**Solución:** Espera unos minutos y reinicia, o ejecuta `node register-commands.js`

---

## ❌ Logs de Error de Autenticación

Si ves esto, el token es incorrecto:

```
❌ [BOT LOGIN ERROR] Invalid token
```

**Solución:** Verifica que el BOT_TOKEN en Railway sea correcto

---

## ❌ Logs de Variables Faltantes

Si ves esto, faltan variables de entorno:

```
❌ ERROR: Missing required environment variables:
   - SH_API_KEY
   - SH_SHOP_ID
```

**Solución:** Agrega las variables faltantes en Railway Settings → Variables

---

## 📝 Qué Buscar en los Logs

1. **¿Se conectó el bot?**
   - Busca: `✅ Successfully connected` o `ready!`

2. **¿Cuántos comandos cargó?**
   - Busca: `✅ Loaded X commands into memory`

3. **¿Intentó registrar comandos?**
   - Busca: `🚀 Attempting to register X commands...`

4. **¿Se registraron exitosamente?**
   - Busca: `✅ Successfully registered X commands`

5. **¿Hay errores?**
   - Busca: `❌` o `⚠️` seguido de mensajes de error

---

## 🔍 Comandos para Verificar

Después de que el bot inicie, escribe `/` en Discord y verifica:

- Si ves **35 comandos** → ✅ Todo funcionó
- Si ves **menos de 35** → ⚠️ Algunos no se registraron
- Si ves **solo 3** → ❌ El token aún está bloqueado

---

## 💡 Si los Comandos No Aparecen

1. Espera 2-3 minutos (Discord puede tardar en actualizar)
2. Cierra y abre Discord completamente
3. Verifica que el bot tenga permisos en el servidor
4. Revisa los logs para ver si hubo errores

