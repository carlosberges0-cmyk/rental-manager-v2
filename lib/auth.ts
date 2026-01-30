import NextAuth, { type NextAuthConfig } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { createTransport } from "nodemailer"

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

const emailFrom = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.RESEND_FROM_EMAIL
const ownerEmail = process.env.AUTH_OWNER_EMAIL

function shouldUseResendFallback(from: string | undefined, recipient: string): boolean {
  if (!from || !from.endsWith("@resend.dev")) return false
  if (!ownerEmail) return true // No owner configured → assume we're in dev/preview
  return recipient.toLowerCase() !== ownerEmail.toLowerCase().trim()
}

export const authOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    EmailProvider({
      server: {
        host: process.env.SMTP_HOST || "smtp.resend.com",
        port: Number(process.env.SMTP_PORT || 587),
        auth: {
          user: process.env.SMTP_USER || "resend",
          pass: process.env.SMTP_PASSWORD || process.env.RESEND_API_KEY,
        },
      },
      from: emailFrom,
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        const from = provider.from ?? emailFrom

        if (shouldUseResendFallback(from, identifier)) {
          console.log("[Auth] Resend fallback (resend.dev + non-owner): magic link logged instead of sending email")
          console.log("[Auth] Magic link for", identifier, ":", url)
          return
        }

        const transport = createTransport(provider.server)

        try {
          const result = await transport.sendMail({
            to: identifier,
            from: from,
            subject: `Iniciar sesión en Rental Manager`,
            text: `Para iniciar sesión, haz clic en el siguiente enlace:\n\n${url}\n\nEste enlace expirará en 24 horas.\n\nSi no solicitaste este enlace, puedes ignorar este email.`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #1B5E20; font-size: 24px; margin-bottom: 20px;">Iniciar sesión en Rental Manager</h1>
                <p style="color: #333; font-size: 16px; line-height: 1.5;">
                  Para iniciar sesión, haz clic en el siguiente botón:
                </p>
                <div style="margin: 30px 0;">
                  <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #1B5E20; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Iniciar sesión
                  </a>
                </div>
                <p style="color: #666; font-size: 14px; line-height: 1.5;">
                  O copia y pega este enlace en tu navegador:<br>
                  <a href="${url}" style="color: #1B5E20; word-break: break-all;">${url}</a>
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                  Este enlace expirará en 24 horas.<br>
                  Si no solicitaste este enlace, puedes ignorar este email.
                </p>
              </div>
            `,
          })

          const failed = result.rejected.concat(result.pending).filter(Boolean)
          if (failed.length) {
            throw new Error(`Email (${failed.join(", ")}) could not be sent`)
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          console.warn("[Auth] Email send failed, logging magic link as fallback:", message)
          console.log("[Auth] Magic link for", identifier, ":", url)
          return
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
