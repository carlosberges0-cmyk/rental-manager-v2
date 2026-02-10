import type { NextRequest } from "next/server"
import { handlers } from "@/lib/auth"

/** Wrapper que captura cualquier error no manejado en el flujo de auth. */
async function wrap(
  fn: (req: NextRequest) => Promise<Response>,
  req: NextRequest
): Promise<Response> {
  try {
    return await fn(req)
  } catch (e) {
    const tag = "route"
    const err = e instanceof Error ? e : new Error(String(e))
    console.error(`[auth] ${tag} message:`, err.message)
    console.error(`[auth] ${tag} stack:`, err.stack)
    const cause = (err as any).cause
    if (cause) {
      console.error(`[auth] ${tag} cause:`, cause)
      if (typeof cause === "object" && "err" in cause && cause.err instanceof Error) {
        console.error(`[auth] ${tag} cause.err message:`, cause.err.message)
      }
    }
    throw e
  }
}

export async function GET(req: NextRequest) {
  return wrap(handlers.GET, req)
}

export async function POST(req: NextRequest) {
  return wrap(handlers.POST, req)
}
