import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

/**
 * Auth.js v5 — Google OAuth only.
 * Env vars (Auth.js v5): AUTH_SECRET, AUTH_URL, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST.
 */

const googleId = process.env.AUTH_GOOGLE_ID?.trim()
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim()

const authDebug = process.env.AUTH_DEBUG === "true"

/** Logging profundo: expone err, err.cause, err.cause.err para ver el error real. */
function logError(tag: string, err: unknown) {
  const e = err instanceof Error ? err : new Error(String(err))
  console.error(`[auth] ${tag} message:`, e.message)
  console.error(`[auth] ${tag} stack:`, e.stack)
  const cause = (e as any).cause
  if (cause !== undefined && cause !== null) {
    console.error(`[auth] ${tag} cause:`, cause)
    if (typeof cause === "object" && "err" in cause && cause.err instanceof Error) {
      console.error(`[auth] ${tag} cause.err message:`, cause.err.message)
      console.error(`[auth] ${tag} cause.err stack:`, cause.err.stack)
    }
  }
  // Guardar para que /api/auth/last-error pueda exponerlo (debug)
  if (typeof globalThis !== "undefined") {
    (globalThis as any).__authLastError = {
      tag,
      message: e.message,
      stack: e.stack,
      cause: cause ? String(cause) : undefined,
      causeErr: (cause && typeof cause === "object" && "err" in cause && cause.err instanceof Error)
        ? { message: cause.err.message, stack: cause.err.stack }
        : undefined,
      at: new Date().toISOString(),
    }
  }
}

function wrapAdapter<T extends object>(adapter: T): T {
  const wrapped = {} as T
  for (const key of Object.keys(adapter) as (keyof T & string)[]) {
    const fn = adapter[key]
    if (typeof fn === "function") {
      (wrapped as any)[key] = async (...args: unknown[]) => {
        try {
          return await (fn as Function)(...args)
        } catch (e) {
          logError(`adapter.${String(key)}`, e)
          throw e
        }
      }
    } else {
      (wrapped as any)[key] = fn
    }
  }
  return wrapped
}

const baseAdapter = PrismaAdapter(prisma)

const authUrl = (process.env.AUTH_URL || process.env.NEXTAUTH_URL)?.replace(/\/$/, "")
const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: wrapAdapter(baseAdapter) as typeof baseAdapter,
  trustHost: true,
  basePath: "/api/auth",
  ...(authUrl && { url: authUrl }), // En Vercel: AUTH_URL=https://tu-dominio.vercel.app
  // Fix PKCE cookie en Vercel: configuración explícita para evitar "cookie was missing"
  cookies: isProd
    ? {
        pkceCodeVerifier: {
          options: {
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 900,
            httpOnly: true,
          },
        },
        state: {
          options: {
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 900,
            httpOnly: true,
          },
        },
      }
    : undefined,
  debug: authDebug || process.env.NODE_ENV === "development",
  logger: {
    error(err: Error) {
      logError("logger.error", err)
    },
  },
  providers:
    googleId && googleSecret
      ? [Google({ clientId: googleId, clientSecret: googleSecret })]
      : [],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn(...args) {
      try {
        return true
      } catch (e) {
        logError("callback.signIn", e)
        throw e
      }
    },
    async session({ session, token }) {
      try {
        if (session?.user && token?.sub) {
          session.user.id = token.sub
        }
        return session
      } catch (e) {
        logError("callback.session", e)
        throw e
      }
    },
    async jwt({ token, user }) {
      try {
        if (user?.id) {
          token.sub = user.id
        }
        return token
      } catch (e) {
        logError("callback.jwt", e)
        throw e
      }
    },
  },
})
