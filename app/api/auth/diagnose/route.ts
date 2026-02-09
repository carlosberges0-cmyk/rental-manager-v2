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
  checks.GOOGLE_CLIENT_ID = {
    ok: !!(process.env.GOOGLE_CLIENT_ID?.trim()),
    message: process.env.GOOGLE_CLIENT_ID?.trim() ? "Definida" : "FALTA",
  }
  checks.GOOGLE_CLIENT_SECRET = {
    ok: !!(process.env.GOOGLE_CLIENT_SECRET?.trim()),
    message: process.env.GOOGLE_CLIENT_SECRET?.trim() ? "Definida" : "FALTA",
  }
  checks.NEXTAUTH_URL = {
    ok: !!(process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.VERCEL_URL),
    message: (process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.VERCEL_URL) ? "Definida" : "FALTA",
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

  // 3. Modelo Account (para Google OAuth)
  try {
    if (typeof (prisma as any).account !== "undefined") {
      checks.ACCOUNT_TABLE = { ok: true, message: "Modelo Account disponible" }
    } else {
      checks.ACCOUNT_TABLE = { ok: false, message: "Modelo Account no disponible" }
    }
  } catch (e) {
    checks.ACCOUNT_TABLE = { ok: false, message: e instanceof Error ? e.message : String(e) }
  }

  const allOk = Object.values(checks).every((c) => c.ok)

  return NextResponse.json({
    status: allOk ? "OK" : "ERROR",
    checks,
  })
}
