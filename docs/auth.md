# Autenticación — NextAuth v5 (Auth.js) + Google OAuth

Este proyecto usa **NextAuth v5 (Auth.js)** con autenticación mediante **Google OAuth**.

## Variables de entorno requeridas

### Obligatorias

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `AUTH_SECRET` o `NEXTAUTH_SECRET` | Secret para cifrar cookies/JWT. Mínimo 32 caracteres. | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` o `GOOGLE_CLIENT_ID` | Client ID de Google Cloud Console | `xxx.apps.googleusercontent.com` |
| `AUTH_GOOGLE_SECRET` o `GOOGLE_CLIENT_SECRET` | Client Secret de Google Cloud Console | (string secreto) |
| `DATABASE_URL` | URL de PostgreSQL (Prisma) | `postgresql://user:pass@host:5432/db` |

### Para producción (Vercel)

| Variable | Valor | Notas |
|----------|-------|-------|
| `AUTH_URL` o `NEXTAUTH_URL` | `https://rental-manager-v2.vercel.app` | Debe coincidir con la URL real de la app |
| `AUTH_TRUST_HOST` | `true` | Necesario detrás de proxy (Vercel) |

## Google Cloud Console — URI de redirección

En **APIs y servicios → Credenciales → tu cliente OAuth 2.0 → URIs de redirección autorizados**, agregá:

```
https://rental-manager-v2.vercel.app/api/auth/callback/google
```

Para preview deployments (opcional), agregá también:

```
https://TU-PREVIEW-SLUG.vercel.app/api/auth/callback/google
```

## Checklist para Vercel

- [ ] **Variables definidas** en Vercel → Settings → Environment Variables:
  - `AUTH_SECRET` o `NEXTAUTH_SECRET` (≥32 caracteres)
  - `AUTH_GOOGLE_ID` o `GOOGLE_CLIENT_ID`
  - `AUTH_GOOGLE_SECRET` o `GOOGLE_CLIENT_SECRET`
  - `NEXTAUTH_URL` = `https://rental-manager-v2.vercel.app`
  - `AUTH_TRUST_HOST` = `true` (string)
  - `DATABASE_URL` (PostgreSQL)

- [ ] **URI en Google Cloud Console**:  
  `https://rental-manager-v2.vercel.app/api/auth/callback/google`

- [ ] **Redeploy sin cache**:  
  Vercel → Deployments → ⋮ en el último deployment → Redeploy (sin usar build cache)

- [ ] **Diagnóstico**: después del deploy, visitá  
  `https://rental-manager-v2.vercel.app/api/auth/diagnose`  
  para verificar que todas las variables estén presentes.

## Debugging

Para ver logs de configuración en producción (sin imprimir secretos), agregá temporalmente:

```
AUTH_DEBUG=true
```

Luego revisá los logs en Vercel → Deployment → Logs (Runtime Logs).

## Callback path

El path por defecto de NextAuth para Google OAuth es:

```
/api/auth/callback/google
```

No modificar en el código salvo configuración especial.
