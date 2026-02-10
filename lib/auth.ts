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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  basePath: "/api/auth",
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
})
