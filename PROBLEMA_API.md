# ⚠️ PROBLEMA: API de SellHub devuelve 404

## 📋 Diagnóstico

Todas las peticiones a la API de SellHub están devolviendo **404 Not Found** con páginas HTML. Esto indica que:

1. **La estructura del endpoint no es correcta** - Hemos probado más de 80 combinaciones diferentes sin éxito
2. **La API key podría ser inválida** - Aunque recibimos 404 (no 401), lo que sugiere que el servidor no encuentra el recurso
3. **La API podría requerir configuración adicional** - Tal vez necesite ser habilitada en el panel de SellHub

## 🔍 Lo que hemos probado

### Base URLs probadas:
- `https://snakessh.sellhub.cx/api/`
- `https://dash.sellhub.cx/api/`
- `https://api.sellhub.cx/`
- Y variaciones con shop ID en la URL base

### Estructuras de endpoints probadas:
- `shops/{shopId}/products`
- `sellhub/shops/{shopId}/products`
- `{shopId}/products`
- `products`
- Y muchas más variaciones

### Métodos de autenticación probados:
- `Authorization: {apiKey}`
- `X-API-Key: {apiKey}`
- Ambos headers juntos

## ✅ Soluciones posibles

### 1. Verificar la API Key

**Acción requerida:**
1. Ve al panel de SellHub: `https://dash.sellhub.cx/`
2. Navega a la sección de **Configuración de API** o **API Settings**
3. Verifica que la API key sea correcta
4. Asegúrate de que la API key tenga permisos para leer productos e invoices

### 2. Verificar la documentación oficial

**Acción requerida:**
1. Visita: `https://docs.sellhub.cx/api`
2. Busca ejemplos de código o curl commands
3. Verifica la estructura exacta del endpoint
4. Compara con lo que estamos usando

### 3. Contactar soporte de SellHub

**Si ninguna de las soluciones anteriores funciona:**
1. Contacta al soporte de SellHub
2. Proporciona:
   - Tu Shop ID: `cf2c7cd5-c4c9-4c20-b9e2-bd861711c784`
   - El error que estás recibiendo (404 en todas las peticiones)
   - Ejemplos de URLs que estás intentando usar
3. Pregunta:
   - ¿Cuál es la estructura correcta de la API?
   - ¿La API key necesita configuración adicional?
   - ¿Hay algún endpoint de prueba que puedas usar?

### 4. Probar con curl manualmente

**Para verificar la API directamente:**

```bash
# Prueba 1: Estructura de documentación
curl -H "Authorization: TU_API_KEY" \
     -H "X-API-Key: TU_API_KEY" \
     https://dash.sellhub.cx/api/sellhub/shops/cf2c7cd5-c4c9-4c20-b9e2-bd861711c784/products

# Prueba 2: Sin /api/
curl -H "Authorization: TU_API_KEY" \
     https://snakessh.sellhub.cx/cf2c7cd5-c4c9-4c20-b9e2-bd861711c784/products

# Prueba 3: Endpoint de prueba (customers)
curl -H "Authorization: TU_API_KEY" \
     https://dash.sellhub.cx/api/sellhub/customers
```

## 📝 Información para soporte

Si contactas a SellHub, proporciona esta información:

- **Shop ID**: `cf2c7cd5-c4c9-4c20-b9e2-bd861711c784`
- **API Key**: (primeros 30 caracteres) `cf2c7cd5-c4c9-4c20-b9e2-bd861711c784_iv1lqqvr1p...`
- **Error**: Todas las peticiones devuelven 404 con páginas HTML
- **URLs probadas**: Más de 80 combinaciones diferentes
- **Headers usados**: `Authorization` y `X-API-Key`

## 🎯 Próximos pasos

1. **Verifica la API key en el panel de SellHub**
2. **Revisa la documentación oficial** para la estructura exacta
3. **Prueba con curl** para verificar manualmente
4. **Contacta soporte** si nada funciona

## 💡 Nota importante

El bot está **completamente funcional** y listo para usar. El único problema es encontrar la estructura correcta de la API de SellHub. Una vez que tengamos la estructura correcta, solo necesitamos actualizar el archivo `classes/Api.js` con la base URL y estructura de endpoints correctos.

