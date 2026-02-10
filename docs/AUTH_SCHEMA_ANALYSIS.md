# Análisis: Auth.js v5 + PrismaAdapter + schema.prisma

## Resumen

El schema actual es **compatible** con Auth.js v5 y PrismaAdapter. No hay inconsistencias críticas que expliquen por sí solas el error `Configuration`. Cualquier excepción no "client-safe" (p. ej. errores de adapter/Prisma) se enmascara como `Configuration` por diseño de Auth.js.

## Modelos Auth.js obligatorios

| Modelo | Estado | Notas |
|--------|--------|-------|
| User | ✅ OK | id, name, email, emailVerified, image. Relaciones correctas. |
| Account | ✅ OK | @@unique([provider, providerAccountId]). Adapter usa provider_providerAccountId. |
| Session | ✅ OK | sessionToken @unique. JWT strategy no usa DB sessions. |
| VerificationToken | ⚠️ Ajuste | Sin @@id. Oficial usa @@id([identifier, token]). Conviene alinear. |

## Validación campo por campo

### User
- `id` String @id @default(cuid()) ✅
- `name` String? ✅
- `email` String @unique ✅
- `emailVerified` DateTime? ✅ (Auth.js espera Date | null)
- `image` String? ✅
- `accounts` Account[] ✅
- `sessions` Session[] ✅
- `createdAt`/`updatedAt` ✅ (no afectan al adapter)

### Account
- `userId`, `type`, `provider`, `providerAccountId` ✅
- `refresh_token`, `access_token`, `expires_at`, etc. ✅
- @@unique([provider, providerAccountId]) ✅
- Relación User ✅

### Session
- `sessionToken` @unique ✅ (findUnique por sessionToken)
- `userId`, `expires` ✅

### VerificationToken
- `identifier`, `token`, `expires` ✅
- @@unique([identifier, token]) ✅
- Falta: @@id([identifier, token]) según schema oficial Auth.js

## Por qué se ve "Configuration"

En `@auth/core`, cualquier error que **no** sea "client-safe" se devuelve como `Configuration`:

```ts
const type = isClientSafeErrorType ? error.type : "Configuration"
```

Errores client-safe: CredentialsSignin, OAuthAccountNotLinked, AccessDenied, Verification, etc.  
Errores **no** client-safe: AdapterError, MissingSecret, etc.

Si falla `createUser`, `linkAccount` o cualquier operación de Prisma, Auth.js muestra `Configuration` y el detalle queda en los logs del servidor.

## Edge runtime

No hay `runtime = "edge"` en rutas que usen Prisma. El proxy usa Node.js runtime.

## Recomendación

1. Añadir `@@id([identifier, token])` a VerificationToken para alinearse con el schema oficial.
2. Mantener `AUTH_DEBUG=true` y revisar Vercel Runtime Logs tras el login para ver el error real (AdapterError, Prisma, etc.).
