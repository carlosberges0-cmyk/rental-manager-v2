import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * Diagnóstico del flujo de auth.
 * Llamá a GET /api/auth/diagnose para ver el estado.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; message: string }> = {}

  // 1. Variables de entorno (sin mostrar secretos)
  checks.DATABASE_URL = {
    ok: !!process.env.DATABASE_URL,
    message: process.env.DATABASE_URL ? "Definida" : "FALTA",
  }
  checks.AUTH_SECRET = {
    ok: !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
    message: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET ? "Definida" : "FALTA",
  }
  checks.EMAIL_FROM = {
    ok: true,
    message: process.env.EMAIL_FROM ?? "onboarding@resend.dev (default)",
  }
  checks.VERCEL_ENV = {
    ok: true,
    message: process.env.VERCEL_ENV ?? "no definido",
  }

  // 2. Conexión a la base de datos
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.DB_CONNECTION = { ok: true, message: "Conecta OK" }
  } catch (e) {
    checks.DB_CONNECTION = {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    }
  }

  // 3. Tabla VerificationToken (crear token de prueba y borrarlo)
  try {
    const testId = `diagnose-${Date.now()}@test.com`
    const testToken = `diagnose-token-${Date.now()}`
    const expires = new Date(Date.now() + 60000)

    await prisma.verificationToken.create({
      data: { identifier: testId, token: testToken, expires },
    })
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: testId, token: testToken } },
    })
    checks.VERIFICATION_TOKEN = { ok: true, message: "Tabla OK, puede crear/borrar" }
  } catch (e) {
    checks.VERIFICATION_TOKEN = {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok)

  return NextResponse.json({
    status: allOk ? "OK" : "ERROR",
    checks,
  })
}
