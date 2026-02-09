import NextAuth, { type NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * Auth uses Google OAuth only.
 * NextAuth v5 (Auth.js) — prefers AUTH_SECRET, AUTH_URL, AUTH_GOOGLE_ID/SECRET.
 * Legacy: NEXTAUTH_SECRET, NEXTAUTH_URL, GOOGLE_CLIENT_ID/SECRET also supported.
 */

/** Base URL for callbacks. AUTH_URL > NEXTAUTH_URL > VERCEL_URL > localhost. */
export function getBaseUrl(): string {
  const url = process.env.AUTH_URL || process.env.NEXTAUTH_URL
  if (url) return url.startsWith("http") ? url : `https://${url}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

const baseUrl = getBaseUrl()
if (!process.env.NEXTAUTH_URL) process.env.NEXTAUTH_URL = baseUrl
if (!process.env.AUTH_URL) process.env.AUTH_URL = baseUrl
if (!process.env.AUTH_TRUST_HOST) process.env.AUTH_TRUST_HOST = "true"

// Support both Auth.js (AUTH_*) and legacy (NEXTAUTH_*, GOOGLE_*) env vars
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
const hasSecret = !!secret && String(secret).length >= 32
const googleId = (
  process.env.AUTH_GOOGLE_ID ||
  process.env.GOOGLE_CLIENT_ID
)?.trim()
const googleSecret = (
  process.env.AUTH_GOOGLE_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET
)?.trim()
const hasGoogle = !!(googleId && googleSecret)

// Debug logging (no secrets) — only in non-production or when AUTH_DEBUG=true
const shouldLog =
  process.env.NODE_ENV !== "production" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.AUTH_DEBUG === "true"
if (shouldLog) {
  console.log("[auth] Env check:", {
    hasSecret,
    hasGoogle,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    hasAuthUrl: !!process.env.AUTH_URL,
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    hasGoogleId: !!googleId,
    hasGoogleSecret: !!googleSecret,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    baseUrl,
  })
}

// Rutas que el cliente espera como JSON (session, csrf, etc.) - no redirigir
const jsonPaths = ["/api/auth/session", "/api/auth/csrf", "/api/auth/providers", "/api/auth/get-session"]

function fallbackHandlers() {
  const errorUrl = new URL("/auth/error?error=Configuration", baseUrl)
  // Session/csrf deben devolver JSON para que el cliente no falle con "Unexpected token '<'"
  const jsonResponse = (path: string) => {
    if (path.includes("/session")) return NextResponse.json({})
    if (path.includes("/csrf")) return NextResponse.json({ csrfToken: "" })
    if (path.includes("/providers")) return NextResponse.json({})
    return NextResponse.json({ error: "Configuration" }, { status: 500 })
  }
  const redirect = () => NextResponse.redirect(errorUrl)

  return {
    GET: (req: Request) => {
      const path = new URL(req.url).pathname
      return jsonPaths.some((p) => path.startsWith(p)) ? jsonResponse(path) : redirect()
    },
    POST: (req: Request) => {
      const path = new URL(req.url).pathname
      return jsonPaths.some((p) => path.startsWith(p)) ? jsonResponse(path) : redirect()
    },
  }
}

export const authOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret: hasSecret ? secret : undefined,
  trustHost: true,
  basePath: "/api/auth",
  debug: process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview",
  providers: hasGoogle
    ? [Google({ clientId: googleId!, clientSecret: googleSecret! })]
    : [],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn() {
      return true
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
      }
      return token
    },
  },
} satisfies NextAuthConfig

// Si faltan variables, usar handlers que redirigen a /auth/error (evita "Server error" genérico)
const { auth, handlers: nextAuthHandlers, signIn, signOut } =
  hasSecret && hasGoogle ? NextAuth(authOptions) : { auth: null, handlers: fallbackHandlers(), signIn: null, signOut: null }

function wrapWithErrorLogging(
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req)
    } catch (err) {
      if (shouldLog) {
        console.error("[auth] Handler error:", err instanceof Error ? err.message : String(err))
        if (err instanceof Error && err.stack) {
          console.error("[auth] Stack:", err.stack)
        }
      }
      throw err
    }
  }
}

const rawHandlers = nextAuthHandlers as { GET?: (req: Request) => Promise<Response>; POST?: (req: Request) => Promise<Response> }
const handlers = {
  GET: rawHandlers.GET ? wrapWithErrorLogging(rawHandlers.GET) : undefined,
  POST: rawHandlers.POST ? wrapWithErrorLogging(rawHandlers.POST) : undefined,
}

export { auth, handlers, signIn, signOut }
