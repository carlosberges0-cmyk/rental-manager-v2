import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Intercepta /api/auth/error y redirige a nuestra página de error con instrucciones.
 * Tiene prioridad sobre el [...nextauth] catch-all.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const error = searchParams.get("error") || "Configuration"
  const redirectUrl = new URL(`/auth/error?error=${encodeURIComponent(error)}`, req.url)
  return NextResponse.redirect(redirectUrl)
}

export async function POST(req: NextRequest) {
  return GET(req)
}
