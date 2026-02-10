"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const error = searchParams.get("error") || ""
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null)
  const [loadingDebug, setLoadingDebug] = useState(false)

  const isConfiguration = error === "Configuration"

  // Auto-redirigir a sign-in: el primer intento falla por cold start en Vercel,
  // pero al reintentar funciona. Redirigimos automáticamente para que el usuario
  // llegue a sign-in con las funciones ya calientes.
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/auth/signin")
    }, 800)
    return () => clearTimeout(t)
  }, [router])

  const fetchDebugError = async () => {
    setLoadingDebug(true)
    setDebugInfo(null)
    try {
      const res = await fetch("/api/auth/last-error")
      const data = await res.json()
      setDebugInfo(data)
    } catch {
      setDebugInfo({ error: "No se pudo obtener el error" })
    } finally {
      setLoadingDebug(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-lg border border-gray-200 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-red-600" style={{ color: "#dc2626" }}>
            Error al iniciar sesión
          </CardTitle>
          <CardDescription style={{ color: "#374151" }}>
            {isConfiguration
              ? "Hay un problema con la configuración del servidor."
              : "Ocurrió un error durante el inicio de sesión."}
            <span className="block mt-2 font-medium">Redirigiendo al login para reintentar...</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConfiguration && (
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold mb-2">Verificá estas variables en Vercel → Settings → Environment Variables:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>AUTH_SECRET</strong> o <strong>NEXTAUTH_SECRET</strong> — mínimo 32 caracteres (<code className="bg-amber-100 px-1 rounded">openssl rand -base64 32</code>)</li>
                <li><strong>AUTH_GOOGLE_ID</strong>/<strong>GOOGLE_CLIENT_ID</strong> y <strong>AUTH_GOOGLE_SECRET</strong>/<strong>GOOGLE_CLIENT_SECRET</strong> — desde Google Cloud Console</li>
                <li><strong>NEXTAUTH_URL</strong> — debe coincidir EXACTAMENTE con la URL que usás (ej: <code className="bg-amber-100 px-1 rounded">https://rental-manager-v2.vercel.app</code>)</li>
              </ul>
              <p className="font-semibold mt-4 mb-1">⚠️ Google Cloud Console — URI de redirección:</p>
              <p className="text-xs">En Google Cloud → APIs y servicios → Credenciales → tu cliente OAuth 2.0 → URIs de redirección autorizados, agregá EXACTAMENTE:</p>
              <code className="block mt-1 p-2 bg-amber-100 rounded text-xs break-all">https://[tu-dominio]/api/auth/callback/google</code>
              <p className="mt-3 text-xs">Si usás <code className="bg-amber-100 px-1 rounded">rental-manager-v2.vercel.app</code> debe ser <code className="bg-amber-100 px-1 rounded">https://rental-manager-v2.vercel.app/api/auth/callback/google</code></p>
              <p className="mt-3 text-xs">Después de cambiar variables o la URI en Google, redeployá.</p>
              <a href="/api/auth/diagnose" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-amber-700 underline">
                Ver diagnóstico de configuración →
              </a>
              <div className="mt-4 pt-4 border-t border-amber-200">
                <button
                  type="button"
                  onClick={fetchDebugError}
                  disabled={loadingDebug}
                  className="rounded-md border px-3 py-1.5 text-sm"
                  style={{ borderColor: "#d97706", color: "#92400e", backgroundColor: "#fffbeb" }}
                >
                  {loadingDebug ? "Cargando..." : "Ver error real del servidor"}
                </button>
                {debugInfo && (
                  <pre className="mt-2 p-3 bg-amber-100 rounded text-xs overflow-auto max-h-48">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: "#1B5E20", color: "#ffffff", textDecoration: "none" }}
            >
              Volver a intentar
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-gray-400 px-4 py-2 text-sm font-medium"
              style={{ color: "#111827", backgroundColor: "#f9fafb", textDecoration: "none" }}
            >
              Ir al inicio
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader><CardTitle>Cargando...</CardTitle></CardHeader>
        </Card>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
