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

function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1].trim() : from.trim()
}

function customSendVerificationRequest(params: {
  identifier: string
  url: string
  provider?: { from?: string }
}) {
  const url = params?.url ?? ""
  const identifier = params?.identifier ?? ""

  const safeLogAndReturn = (): Promise<void> => {
    try {
      console.log("[AUTH MAGIC LINK]", url)
    } catch {
      /* ignore */
    }
    return Promise.resolve()
  }

  try {
    const fromRaw = (process.env.EMAIL_FROM ?? params?.provider?.from ?? "onboarding@resend.dev") as string
    const senderEmail = extractSenderEmail(fromRaw).toLowerCase()
    const senderIsResendDev = senderEmail.endsWith("@resend.dev")
    const owner = process.env.AUTH_OWNER_EMAIL?.toLowerCase().trim()
    const recipient = String(identifier).toLowerCase().trim()

    try {
      console.log("[AUTH EMAIL CONFIG]", {
        senderEmail,
        senderIsResendDev,
        recipient,
        ownerPresent: !!owner,
      })
    } catch {
      /* ignore */
    }

    if (senderIsResendDev) {
      return safeLogAndReturn()
    }

    const apiKey = process.env.RESEND_API_KEY ?? process.env.SMTP_PASSWORD
    if (!apiKey) {
      return safeLogAndReturn()
    }

    const resend = new Resend(apiKey)
    return resend.emails
      .send({
        from: fromRaw,
        to: identifier,
        subject,
        html: htmlTemplate(url),
        text: textTemplate(url),
      })
      .then(({ error }) => {
        if (error) {
          try {
            console.error("[AUTH EMAIL SEND FAILED]", error)
          } catch {
            /* ignore */
          }
          return safeLogAndReturn()
        }
      })
      .catch((err) => {
        try {
          console.error("[AUTH EMAIL SEND FAILED]", err)
        } catch {
          /* ignore */
        }
        return safeLogAndReturn()
      }) as Promise<void>
  } catch (err) {
    try {
      console.error("[AUTH EMAIL SEND FAILED]", err)
    } catch {
      /* ignore */
    }
    return safeLogAndReturn()
  }
}

export const authOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview",
  providers: [
    EmailProvider({
      server: { host: "localhost", port: 25 },
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
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
