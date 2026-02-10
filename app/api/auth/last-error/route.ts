import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Dev/debug: expone el último error de auth capturado por nuestro logger.
 * Solo útil si el request llega a la misma instancia serverless donde ocurrió el error.
 */
export async function GET() {
  const err = (globalThis as any).__authLastError
  if (!err) {
    return NextResponse.json({
      ok: false,
      message: "No hay error reciente capturado (o la instancia es distinta).",
    })
  }
  return NextResponse.json({ ok: true, error: err })
}
