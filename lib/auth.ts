import NextAuth, { type NextAuthConfig } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import ResendProvider from "next-auth/providers/resend"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { Resend } from "resend"
import { prisma } from "@/lib/prisma"

/**
 * Auth uses Resend API for magic-link emails. No SMTP.
 * Env: RESEND_API_KEY (or AUTH_RESEND_KEY), EMAIL_FROM
 */

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

function customSendVerificationRequest(params: {
  identifier: string
  url: string
  provider?: { from?: string }
}) {
  const url = params?.url ?? ""
  const identifier = params?.identifier ?? ""
  const from = (process.env.EMAIL_FROM ?? params?.provider?.from ?? "").trim()
  const apiKey = process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY

  if (!apiKey) {
    console.error("[AUTH EMAIL] RESEND_API_KEY and AUTH_RESEND_KEY are not set")
    return Promise.resolve()
  }

  if (!from) {
    console.error("[AUTH EMAIL] EMAIL_FROM is not set")
    return Promise.resolve()
  }

  const resend = new Resend(apiKey)
  return resend.emails
    .send({
      from,
      to: identifier,
      subject,
      html: htmlTemplate(url),
      text: textTemplate(url),
    })
    .then(({ data, error }) => {
      if (error) {
        console.error("[AUTH EMAIL SEND FAILED]", JSON.stringify(error, null, 2))
      } else {
        console.log("[AUTH EMAIL SEND OK]", { to: identifier, resendId: data?.id })
      }
    })
    .catch((err) => {
      console.error("[AUTH EMAIL SEND FAILED]", err instanceof Error ? err.message : String(err), err)
    }) as Promise<void>
}

export const authOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview",
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    ResendProvider({
      id: "email",
      apiKey: process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY ?? "",
      from: process.env.EMAIL_FROM ?? "",
      sendVerificationRequest: customSendVerificationRequest,
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
    async signIn({ email }) {
      if (email?.verificationRequest) return true
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
