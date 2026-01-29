# 📧 Guía Paso a Paso: Configurar Resend para Autenticación

Esta guía te muestra cómo configurar Resend (más fácil que Gmail) para enviar emails de autenticación.

---

## 📝 PASO 1: Crear cuenta en Resend

### 1.1. Ir a Resend

1. Abre tu navegador
2. Ve a: **https://resend.com**
3. Haz clic en **"Sign Up"** (Registrarse) o **"Get Started"** (Comenzar)

### 1.2. Registrarse

1. Ingresa tu email y crea una contraseña
2. O regístrate con Google/GitHub si prefieres
3. Confirma tu email si es necesario

### 1.3. Verificar tu dominio (Opcional para desarrollo)

Para desarrollo local, **NO necesitas verificar un dominio**. Resend te permite usar su dominio de prueba.

Para producción, necesitarás verificar tu dominio después.

---

## 🔑 PASO 2: Obtener API Key

### 2.1. Ir a API Keys

1. Una vez dentro de Resend, en el menú lateral
2. Haz clic en **"API Keys"** (Claves API)
3. O ve directamente a: https://resend.com/api-keys

### 2.2. Crear una nueva API Key

1. Haz clic en el botón **"Create API Key"** (Crear Clave API)
2. Dale un nombre (ej: "Rental Manager Development")
3. Selecciona los permisos: **"Full Access"** (para desarrollo) o **"Sending Access"** (para producción)
4. Haz clic en **"Create"** (Crear)
5. **⚠️ IMPORTANTE: Resend te mostrará la API Key UNA SOLA VEZ**
   - **CÓPIALA INMEDIATAMENTE** - no podrás verla de nuevo
   - La clave se verá así: `re_123456789abcdefghijklmnopqrstuvwxyz`

### 2.3. Guardar la API Key

- Copia la API Key completa (empieza con `re_`)
- Guárdala en un lugar seguro (lo usarás en el siguiente paso)

---

## 📧 PASO 3: Configurar Email de Remitente

### 3.1. Obtener email de prueba (Para desarrollo)

Para desarrollo, Resend te permite usar un email de prueba:
- Formato: `onboarding@resend.dev`
- Este email funciona automáticamente sin verificación

**Para producción**, necesitarás:
1. Verificar tu dominio en Resend
2. O agregar y verificar un email específico

### 3.2. Ver dominio en Resend

1. Ve a la sección **"Domains"** (Dominios) en Resend
2. Verás tu dominio de prueba: `resend.dev`
3. Puedes usar: `onboarding@resend.dev` para desarrollo

---

## ⚙️ PASO 4: Configurar Variables de Entorno

### 4.1. Abrir archivo `.env`

Abre el archivo `.env` en la raíz del proyecto.

### 4.2. Agregar/Actualizar variables

Agrega o actualiza estas líneas en tu `.env`:

```env
# Database (ya deberías tener esto)
DATABASE_URL="postgresql://user:password@localhost:5432/rental_manager?schema=public"

# NextAuth - OBLIGATORIO
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="AQUI_VA_TU_SECRET"

# Resend SMTP - OBLIGATORIO
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASSWORD="AQUI_VA_TU_RESEND_API_KEY"
SMTP_FROM="onboarding@resend.dev"

# O puedes usar estas variables alternativas (más claras para Resend)
RESEND_API_KEY="AQUI_VA_TU_RESEND_API_KEY"
RESEND_FROM_EMAIL="onboarding@resend.dev"
```

### 4.3. Generar NEXTAUTH_SECRET (si no lo tienes)

En una terminal, ejecuta:

```bash
openssl rand -base64 32
```

Copia el resultado y úsalo como `NEXTAUTH_SECRET`.

### 4.4. Reemplazar valores

1. **`NEXTAUTH_SECRET`**: Pega el secret que generaste
2. **`SMTP_PASSWORD`** o **`RESEND_API_KEY`**: Pega la API Key de Resend (la que empieza con `re_`)
3. **`SMTP_FROM`** o **`RESEND_FROM_EMAIL`**: Usa `onboarding@resend.dev` para desarrollo

**Ejemplo final del `.env`:**

```env
DATABASE_URL="postgresql://user:password@localhost:5432/rental_manager?schema=public"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="aB3xY9mN2pQ7rT5vW8zX1cD4fG6hJ0kL9mN2pQ7rT5="

SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASSWORD="re_123456789abcdefghijklmnopqrstuvwxyz"
SMTP_FROM="onboarding@resend.dev"
```

---

## 🔄 PASO 5: Reiniciar el Servidor

### 5.1. Detener el servidor (si está corriendo)

1. Ve a la terminal donde está corriendo el servidor
2. Presiona `Ctrl + C` para detenerlo

### 5.2. Iniciar el servidor

En la terminal, ejecuta:

```bash
npm run dev
```

Deberías ver:
```
▲ Next.js 16.1.1
- Local:        http://localhost:3000
- Ready in X.Xs
```

**⚠️ IMPORTANTE:** Siempre reinicia el servidor después de cambiar variables de entorno.

---

## ✅ PASO 6: Probar el Login

### 6.1. Abrir el navegador

1. Abre tu navegador
2. Ve a: **http://localhost:3000**

### 6.2. Verificar redirección

Deberías ser **automáticamente redirigido** a:
```
http://localhost:3000/auth/signin
```

### 6.3. Ingresar email

1. En la página de login, ingresa tu email
   - Si estás usando `SMTP_FROM="onboarding@resend.dev"` (dominio de prueba `resend.dev`), **Resend solo permite enviar a tu propio email** (el de tu cuenta de Resend).
   - Para enviar a otros emails (otros usuarios), **tenés que verificar un dominio** en Resend y usar un remitente de ese dominio.
2. Haz clic en **"Enviar enlace de acceso"**

### 6.4. Revisar email

1. Abre la bandeja de entrada del email que ingresaste
2. **Busca un email con el asunto:** "Iniciar sesión en Rental Manager"
3. El email debería llegar en **segundos** (Resend es muy rápido)
4. **Revisa también la carpeta de Spam** si no lo ves

### 6.5. Hacer clic en el enlace

1. Haz clic en el botón **"Iniciar sesión"** del email
2. Deberías ser redirigido a la aplicación
3. ¡Ya estás autenticado! 🎉

---

## 🚀 Ventajas de Resend vs Gmail

✅ **No necesitas verificación en 2 pasos**
✅ **No necesitas contraseña de aplicación** - solo la API Key
✅ **Más rápido** - Los emails llegan en segundos
✅ **Más confiable** - Diseñado para aplicaciones
✅ **Mejor para producción** - APIs profesionales
✅ **Email de prueba gratis** - `onboarding@resend.dev` funciona sin configuración

---

## 📊 Límites de Resend

### Plan Gratuito (Free Tier)

- **3,000 emails/mes** gratis
- Perfecto para desarrollo y proyectos pequeños
- Sin tarjeta de crédito requerida

### Planes Pagos

- Plan Pro: $20/mes - 50,000 emails
- Plan Business: $80/mes - 200,000 emails
- Para más información: https://resend.com/pricing

---

## 🐛 Solución de Problemas

### ❌ Error: "Invalid API Key"

**Problema:** La API Key de Resend no es válida

**Solución:**
1. Verifica que copiaste la API Key completa (debe empezar con `re_`)
2. Verifica que no hay espacios antes o después
3. Asegúrate de que esté entre comillas en el `.env`
4. Revisa en Resend que la API Key esté activa

### ❌ Error: "Email could not be sent"

**Problema:** La configuración SMTP está incorrecta

**Solución:**
1. Verifica que `SMTP_HOST="smtp.resend.com"`
2. Verifica que `SMTP_PORT="587"`
3. Verifica que `SMTP_USER="resend"`
4. Verifica que `SMTP_PASSWORD` es tu API Key de Resend
5. Verifica que `SMTP_FROM="onboarding@resend.dev"` (para desarrollo)

### ❌ No recibo el email

**Posibles causas:**
1. **Revisa la carpeta de Spam** - A veces va ahí
2. **Verifica que el email sea válido** - No puede tener errores tipográficos
3. **Revisa la consola del servidor** - Puede haber errores visibles
4. **Verifica en Resend** - Ve a la sección "Logs" para ver si el email se envió

### ❌ Error /api/auth/error?error=Configuration al usar otro email

**Causa típica:** estás enviando desde `onboarding@resend.dev` y tratando de enviar el magic link a un destinatario distinto a tu propio email. Resend bloquea eso en el dominio de prueba `resend.dev`.

**Solución:**
1. En Resend, andá a **Domains** y verificá tu dominio (por ejemplo `tu-dominio.com`)
2. Cambiá tu `.env` para usar un remitente de ese dominio:

```env
SMTP_FROM="noreply@tu-dominio.com"
# o RESEND_FROM_EMAIL="noreply@tu-dominio.com"
```

3. Reiniciá `npm run dev`

### ❌ Veo "Rate limit exceeded"

**Problema:** Has enviado demasiados emails (límite del plan gratuito)

**Solución:**
1. Espera un momento (el límite se resetea)
2. O actualiza a un plan pago si necesitas más
3. Para desarrollo, 3,000 emails/mes debería ser suficiente

---

## 🌐 Para Producción

Cuando estés listo para producción:

### 1. Verificar tu dominio

1. Ve a Resend → **"Domains"**
2. Haz clic en **"Add Domain"**
3. Ingresa tu dominio (ej: `tu-dominio.com`)
4. Sigue las instrucciones para verificar (agregar registros DNS)

### 2. Actualizar variables de entorno

En producción, actualiza:

```env
NEXTAUTH_URL="https://tu-dominio.com"
SMTP_FROM="noreply@tu-dominio.com"  # O cualquier email de tu dominio verificado
```

### 3. Usar variables de entorno de producción

- En Vercel: Configura las variables en Settings → Environment Variables
- En otros servicios: Configúralas según la documentación del servicio

---

## 📋 Checklist Final

Antes de considerar que está todo configurado:

- [ ] Cuenta creada en Resend
- [ ] API Key generada y copiada
- [ ] Archivo `.env` actualizado con las variables de Resend
- [ ] `NEXTAUTH_SECRET` generado y configurado
- [ ] `SMTP_PASSWORD` contiene la API Key de Resend
- [ ] `SMTP_FROM` configurado (onboarding@resend.dev para desarrollo)
- [ ] Servidor reiniciado después de cambios
- [ ] Puedes acceder a /auth/signin
- [ ] Puedes recibir emails de verificación
- [ ] Puedes iniciar sesión con el enlace del email

---

## 📚 Recursos Útiles

- **Resend Dashboard**: https://resend.com/emails
- **Documentación de Resend**: https://resend.com/docs
- **Logs de Email**: https://resend.com/emails (para ver qué emails se enviaron)

¡Listo! Resend es mucho más fácil que Gmail. Si tienes algún problema, avísame.
