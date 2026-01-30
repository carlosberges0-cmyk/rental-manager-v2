import NextAuth, { type NextAuthConfig } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { Resend } from "resend"
import { prisma } from "@/lib/prisma"

/** Base URL for callbacks. NEXTAUTH_URL > VERCEL_URL > localhost. */
export function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

// Ensure NEXTAUTH_URL for Vercel preview/production when not set
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`
}

const subject = "Iniciar sesión en Rental Manager"
const htmlTemplate = (url: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1B5E20; font-size: 24px; margin-bottom: 20px;">Iniciar sesión en Rental Manager</h1>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">
      Para iniciar sesión, haz clic en el siguiente enlace:
    </p>
    <p style="margin: 20px 0;">
      <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #1B5E20; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Iniciar sesión</a>
    </p>
    <p style="color: #666; font-size: 14px;">
      O copia este enlace: <a href="${url}" style="color: #1B5E20; word-break: break-all;">${url}</a>
    </p>
    <p style="color: #999; font-size: 12px; margin-top: 30px;">Este enlace expirará en 24 horas.</p>
  </div>
`
const textTemplate = (url: string) =>
  `Para iniciar sesión, haz clic en el siguiente enlace:\n\n${url}\n\nEste enlace expirará en 24 horas.`

export const authOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      server: {},
      sendVerificationRequest: async ({ identifier, url }) => {
        const isProd = process.env.VERCEL_ENV === "production"
        const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev"
        const apiKey = process.env.RESEND_API_KEY ?? process.env.SMTP_PASSWORD
        const useResendDev = from.endsWith("@resend.dev")

        if (useResendDev) {
          console.log("[AUTH MAGIC LINK]", url)
          return
        }

        if (!apiKey) {
          if (isProd) throw new Error("RESEND_API_KEY or SMTP_PASSWORD is not configured")
          console.log("[AUTH MAGIC LINK]", url)
          return
        }

        try {
          const resend = new Resend(apiKey)
          const { error } = await resend.emails.send({
            from,
            to: identifier,
            subject,
            html: htmlTemplate(url),
            text: textTemplate(url),
          })

          if (error) {
            if (isProd) {
              throw new Error(typeof error === "object" && error !== null && "message" in error ? String((error as { message: string }).message) : String(error))
            }
            console.log("[AUTH MAGIC LINK]", url)
          }
        } catch (err) {
          if (isProd) throw err
          console.log("[AUTH MAGIC LINK]", url)
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
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
