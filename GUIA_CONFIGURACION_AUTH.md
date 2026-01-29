# 🔐 Guía Paso a Paso: Configuración de Autenticación

Esta guía te lleva paso a paso para configurar el sistema de login en tu aplicación.

> **💡 RECOMENDACIÓN:** Si no puedes usar Gmail, te recomendamos usar **Resend** (mucho más fácil). 
> Ver la guía completa en: **[GUIA_RESEND.md](./GUIA_RESEND.md)**

Esta guía es para Gmail. Para Resend, consulta la guía específica.

---

## 📝 PASO 1: Configurar Variables de Entorno

### 1.1. Crear o editar el archivo `.env`

En la raíz del proyecto (donde está `package.json`), crea o edita el archivo `.env`.

**Si usas VS Code o cualquier editor:**
- Abre el proyecto en el editor
- Busca el archivo `.env` en la raíz (si no existe, créalo)
- Si no ves archivos que empiezan con punto (`.env`), puede que estén ocultos. En VS Code, puedes hacerlo visible desde la configuración

**Si usas la terminal:**
```bash
# Navega a la carpeta del proyecto
cd /Users/carlosberges/Projects/rental-manager-v2

# Crea el archivo .env si no existe
touch .env

# Abre el archivo en tu editor favorito
# Por ejemplo, en VS Code:
code .env
# O en nano:
nano .env
```

### 1.2. Agregar las variables al archivo `.env`

Abre el archivo `.env` y agrega estas líneas:

```env
# Database (ya deberías tener esto configurado)
DATABASE_URL="postgresql://user:password@localhost:5432/rental_manager?schema=public"

# NextAuth - OBLIGATORIO
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="AQUI_VA_TU_SECRET"

# Email SMTP - OBLIGATORIO
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="tu-email@gmail.com"
SMTP_PASSWORD="AQUI_VA_TU_PASSWORD"
SMTP_FROM="tu-email@gmail.com"
```

**⚠️ IMPORTANTE:** 
- NO pongas comillas dentro de las comillas
- NO dejes espacios antes o después del signo `=`
- Cada línea debe estar en una línea separada

---

## 🔑 PASO 2: Generar NEXTAUTH_SECRET

### 2.1. Abrir una terminal

Abre la terminal en tu Mac (Terminal.app o iTerm).

### 2.2. Generar el secret

Ejecuta este comando:

```bash
openssl rand -base64 32
```

**Ejemplo de salida:**
```
aB3xY9mN2pQ7rT5vW8zX1cD4fG6hJ0kL9mN2pQ7rT5=
```

### 2.3. Copiar el resultado

- Selecciona todo el texto que aparece (ej: `aB3xY9mN2pQ7rT5vW8zX1cD4fG6hJ0kL9mN2pQ7rT5=`)
- Cópialo (Cmd+C)

### 2.4. Pegar en `.env`

Abre tu archivo `.env` y reemplaza `AQUI_VA_TU_SECRET` con el valor que copiaste:

```env
NEXTAUTH_SECRET="aB3xY9mN2pQ7rT5vW8zX1cD4fG6hJ0kL9mN2pQ7rT5="
```

**⚠️ IMPORTANTE:** Mantén las comillas alrededor del valor.

---

## 📧 PASO 3: Configurar Gmail (Si usas Gmail)

### 3.1. Activar verificación en 2 pasos

1. Ve a tu cuenta de Google: https://myaccount.google.com
2. En el menú lateral, haz clic en **"Seguridad"**
3. Busca **"Verificación en 2 pasos"**
4. Si no está activada, actívala siguiendo las instrucciones

### 3.2. Generar contraseña de aplicación

1. Una vez activada la verificación en 2 pasos, vuelve a la página de Seguridad
2. Busca **"Contraseñas de aplicaciones"** (o "App passwords")
3. Si no la ves, ve directamente a: https://myaccount.google.com/apppasswords
4. Selecciona **"Seleccionar aplicación"** → **"Otra (nombre personalizado)"**
5. Escribe: `Rental Manager` (o cualquier nombre)
6. Haz clic en **"Generar"**
7. **Google te mostrará una contraseña de 16 caracteres** (ej: `abcd efgh ijkl mnop`)
   - **Cópiala completa** (incluye los espacios, pero en .env los puedes quitar)

### 3.3. Actualizar `.env` con la contraseña de aplicación

Abre tu archivo `.env` y actualiza estas líneas:

```env
SMTP_USER="tu-email@gmail.com"           # Tu email de Gmail
SMTP_PASSWORD="abcdefghijklmnop"          # La contraseña de aplicación (sin espacios)
SMTP_FROM="tu-email@gmail.com"            # Puede ser el mismo que SMTP_USER
```

**⚠️ IMPORTANTE:** 
- La contraseña de aplicación NO es tu contraseña normal de Gmail
- Es la que Google generó en el paso anterior
- Si la copias con espacios, quítalos (o déjalos, también funciona)

---

## 🔄 PASO 4: Reiniciar el Servidor

### 4.1. Detener el servidor si está corriendo

Si tienes el servidor de desarrollo corriendo:
- Ve a la terminal donde está corriendo
- Presiona `Ctrl + C` para detenerlo

### 4.2. Iniciar el servidor nuevamente

En la terminal, ejecuta:

```bash
cd /Users/carlosberges/Projects/rental-manager-v2
npm run dev
```

Deberías ver algo como:
```
▲ Next.js 16.1.1
- Local:        http://localhost:3000
- Ready in X.Xs
```

**⚠️ IMPORTANTE:** 
- Siempre reinicia el servidor después de cambiar variables de entorno
- Si ves errores, revísalos en la terminal

---

## ✅ PASO 5: Probar el Login

### 5.1. Abrir el navegador

Abre tu navegador y ve a:
```
http://localhost:3000
```

### 5.2. Verificar redirección

Deberías ser **automáticamente redirigido** a:
```
http://localhost:3000/auth/signin
```

Si ves la página de login, ¡perfecto! El middleware está funcionando.

### 5.3. Ingresar tu email

1. En la página de login, verás un campo para email
2. **Ingresa un email válido** (preferiblemente el mismo que configuraste en `SMTP_USER` para pruebas)
3. Haz clic en **"Enviar enlace de acceso"**

### 5.4. Revisar tu email

1. Abre tu bandeja de entrada de Gmail (o el email que usaste)
2. **Busca un email con el asunto:** "Iniciar sesión en Rental Manager"
3. Si no lo ves, **revisa la carpeta de Spam/Correo no deseado**
4. El email debería tener un botón verde "Iniciar sesión" y un enlace

### 5.5. Hacer clic en el enlace

1. Haz clic en el botón **"Iniciar sesión"** del email (o copia el enlace y pégalo en el navegador)
2. Deberías ser redirigido de vuelta a la aplicación
3. Ahora deberías estar **autenticado** y ver el calendario

### 5.6. Verificar que funciona

- Deberías ver la página del calendario (o la página a la que hayas sido redirigido)
- El menú de navegación debería estar visible
- Ya no deberías ver la página de login

---

## 🐛 Solución de Problemas Comunes

### ❌ Error: "Missing NEXTAUTH_SECRET"

**Problema:** Olvidaste agregar `NEXTAUTH_SECRET` al `.env`

**Solución:**
1. Verifica que el archivo `.env` existe
2. Verifica que tiene la línea `NEXTAUTH_SECRET="..."`
3. Reinicia el servidor

### ❌ Error: "Email could not be sent"

**Problema:** Las credenciales SMTP están incorrectas

**Solución:**
1. Verifica que `SMTP_USER` es tu email completo
2. Verifica que `SMTP_PASSWORD` es la contraseña de aplicación (no tu contraseña normal)
3. Verifica que `SMTP_FROM` está configurado
4. Asegúrate de haber activado la verificación en 2 pasos en Google

### ❌ No recibo el email

**Posibles causas:**
1. **Revisa la carpeta de Spam** - Gmail a veces lo marca como spam
2. **Verifica que el email esté correcto** - Revisa que no haya errores tipográficos
3. **Espera unos minutos** - A veces puede tardar 1-2 minutos
4. **Revisa la terminal** - Puede haber errores en la consola del servidor

### ❌ Veo la página de login pero puedo acceder sin login

**Problema:** El middleware no está funcionando

**Solución:**
1. Verifica que el archivo `middleware.ts` existe en la raíz del proyecto
2. Reinicia el servidor completamente
3. Limpia la caché del navegador (Cmd+Shift+R en Mac)

### ❌ Error en la terminal relacionado con NextAuth

**Solución:**
1. Revisa los errores completos en la terminal
2. Verifica que todas las variables de entorno estén correctas
3. Asegúrate de tener las dependencias instaladas: `npm install`
4. Si el error menciona Prisma, ejecuta: `npm run db:generate`

---

## 📋 Checklist Final

Antes de considerar que está todo configurado, verifica:

- [ ] Archivo `.env` creado en la raíz del proyecto
- [ ] `NEXTAUTH_URL` configurado (http://localhost:3000 para desarrollo)
- [ ] `NEXTAUTH_SECRET` generado y agregado
- [ ] `SMTP_HOST` configurado (smtp.gmail.com para Gmail)
- [ ] `SMTP_PORT` configurado (587)
- [ ] `SMTP_USER` configurado con tu email
- [ ] `SMTP_PASSWORD` configurado con contraseña de aplicación
- [ ] `SMTP_FROM` configurado
- [ ] Servidor reiniciado después de cambios
- [ ] Puedes acceder a /auth/signin
- [ ] Puedes recibir emails de verificación
- [ ] Puedes iniciar sesión con el enlace del email

---

## 🚀 Para Producción

Cuando estés listo para poner esto en producción:

1. **Cambia `NEXTAUTH_URL`** a tu dominio:
   ```env
   NEXTAUTH_URL="https://tu-dominio.com"
   ```

2. **Usa un servicio de email profesional** (recomendado):
   - SendGrid
   - Mailgun
   - AWS SES
   - O cualquier servicio SMTP confiable

3. **Genera un nuevo `NEXTAUTH_SECRET`** (no uses el de desarrollo)

4. **Asegúrate de usar HTTPS** (obligatorio para NextAuth en producción)

¡Listo! Si tienes algún problema en cualquier paso, avísame y te ayudo a resolverlo.
