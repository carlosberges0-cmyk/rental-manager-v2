# Configuración de Autenticación - Guía Paso a Paso

Esta guía te ayudará a configurar la autenticación con NextAuth para producción.

## ✅ Cambios Realizados

1. **NextAuth configurado** (`lib/auth.ts`)
   - EmailProvider con magic links
   - PrismaAdapter para persistencia
   - Configuración de sesiones JWT

2. **Middleware de protección** (`middleware.ts`)
   - Protege todas las rutas excepto `/auth/*` y `/api/auth/*`
   - Redirige a `/auth/signin` si no hay sesión

3. **Helper actualizado** (`lib/actions/auth-helper.ts`)
   - `getCurrentUserId()` - Obtiene el ID del usuario de la sesión
   - `getDefaultUserId()` - Mantiene compatibilidad, ahora usa sesión real

## 📋 Variables de Entorno Requeridas

Crea o actualiza tu archivo `.env` con las siguientes variables:

```env
# Database (ya deberías tener esto)
DATABASE_URL="postgresql://user:password@localhost:5432/rental_manager?schema=public"

# NextAuth - OBLIGATORIO
NEXTAUTH_URL="http://localhost:3000"  # En producción: tu dominio completo (ej: https://tu-dominio.com)
NEXTAUTH_SECRET="tu-secret-key-aqui"  # Genera uno con: openssl rand -base64 32

# Email SMTP - OBLIGATORIO para magic links
SMTP_HOST="smtp.gmail.com"            # O tu servidor SMTP
SMTP_PORT="587"                        # Puerto SMTP (587 para TLS, 465 para SSL)
SMTP_USER="tu-email@gmail.com"        # Tu email
SMTP_PASSWORD="tu-app-password"       # Contraseña de aplicación (Gmail) o contraseña normal
SMTP_FROM="noreply@tu-dominio.com"    # Email del remitente (puede ser el mismo que SMTP_USER)
```

## 🔑 Generar NEXTAUTH_SECRET

Ejecuta este comando para generar un secret seguro:

```bash
openssl rand -base64 32
```

Copia el resultado y úsalo como valor de `NEXTAUTH_SECRET`.

## 📧 Configurar Gmail (Ejemplo)

Si usas Gmail:

1. **Habilita la verificación en 2 pasos** en tu cuenta de Google
2. **Genera una contraseña de aplicación**:
   - Ve a https://myaccount.google.com/apppasswords
   - Selecciona "Otra (nombre personalizado)"
   - Copia la contraseña generada
   - Úsala como `SMTP_PASSWORD`

3. **Configuración en .env**:
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="587"
   SMTP_USER="tu-email@gmail.com"
   SMTP_PASSWORD="la-contraseña-de-aplicación-generada"
   SMTP_FROM="tu-email@gmail.com"
   ```

## 🔄 Otros Proveedores SMTP

### SendGrid
```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASSWORD="tu-api-key-de-sendgrid"
SMTP_FROM="noreply@tu-dominio.com"
```

### Mailgun
```env
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT="587"
SMTP_USER="postmaster@tu-dominio.mailgun.org"
SMTP_PASSWORD="tu-password-de-mailgun"
SMTP_FROM="noreply@tu-dominio.com"
```

### Mailtrap (Solo desarrollo/testing)
```env
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT="2525"
SMTP_USER="tu-username-de-mailtrap"
SMTP_PASSWORD="tu-password-de-mailtrap"
SMTP_FROM="noreply@test.com"
```

## 🚀 Pasos para Activar

1. **Configura las variables de entorno** (ver arriba)

2. **Asegúrate de que las migraciones estén aplicadas**:
   ```bash
   npm run db:migrate
   ```

3. **Reinicia el servidor de desarrollo**:
   ```bash
   npm run dev
   ```

4. **Prueba el login**:
   - Ve a http://localhost:3000
   - Deberías ser redirigido a `/auth/signin`
   - Ingresa un email
   - Revisa tu bandeja de entrada (y spam)
   - Haz clic en el enlace para iniciar sesión

## 🔒 Rutas Protegidas

El middleware protege automáticamente todas las rutas excepto:
- `/auth/signin` - Página de login
- `/auth/verify-request` - Página de verificación
- `/api/auth/*` - Rutas de NextAuth

Todas las demás rutas requieren autenticación.

## 📝 Notas Importantes

- **En producción**, asegúrate de usar `https://` en `NEXTAUTH_URL`
- **El secret debe ser único y seguro** - nunca lo compartas públicamente
- **Los magic links expiran en 24 horas** (configuración de NextAuth)
- **Cada usuario debe tener un email único** (el schema de Prisma lo requiere)

## 🐛 Solución de Problemas

### Error: "Missing NEXTAUTH_SECRET"
- Asegúrate de tener `NEXTAUTH_SECRET` en tu `.env`
- Reinicia el servidor después de agregarlo

### Error: "Email could not be sent"
- Verifica las credenciales SMTP
- Asegúrate de que el puerto sea correcto
- Para Gmail, usa contraseña de aplicación, no tu contraseña normal

### No recibo el email
- Revisa la carpeta de spam
- Verifica que `SMTP_FROM` esté configurado correctamente
- Prueba con Mailtrap primero para desarrollo

### Error de sesión
- Limpia las cookies del navegador
- Verifica que `NEXTAUTH_URL` coincida con tu dominio actual
