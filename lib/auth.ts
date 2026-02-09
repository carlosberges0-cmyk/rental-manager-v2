import NextAuth, { type NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

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

// Asegurar NEXTAUTH_URL/AUTH_URL para Vercel (NextAuth v5 requiere URL base)
const baseUrl = getBaseUrl()
if (!process.env.NEXTAUTH_URL) process.env.NEXTAUTH_URL = baseUrl
if (!process.env.AUTH_URL) process.env.AUTH_URL = baseUrl

export const authOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  basePath: "/api/auth",
  debug: process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview",
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
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

// Export the auth function and handlers for NextAuth v5
const { auth, handlers, signIn, signOut } = NextAuth(authOptions)

export { auth, handlers, signIn, signOut }
