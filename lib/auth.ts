import NextAuth, { type NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * Auth uses Google OAuth only.
 * Env: AUTH_SECRET (o NEXTAUTH_SECRET), GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_URL
 */

/** Base URL for callbacks. NEXTAUTH_URL > AUTH_URL > VERCEL_URL > localhost. */
export function getBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL || process.env.AUTH_URL
  if (url) return url.startsWith("http") ? url : `https://${url}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

const baseUrl = getBaseUrl()
if (!process.env.NEXTAUTH_URL) process.env.NEXTAUTH_URL = baseUrl
if (!process.env.AUTH_URL) process.env.AUTH_URL = baseUrl
if (!process.env.AUTH_TRUST_HOST) process.env.AUTH_TRUST_HOST = "true"

// Validar variables requeridas (evita error genérico "Configuration")
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
const hasSecret = !!secret && String(secret).length >= 32
const googleId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
const hasGoogle = !!(googleId && googleSecret)

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

export { auth, nextAuthHandlers as handlers, signIn, signOut }
