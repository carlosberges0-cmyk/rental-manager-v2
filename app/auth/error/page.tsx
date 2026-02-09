"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error") || ""

  const isConfiguration = error === "Configuration"

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-red-600">
            Error al iniciar sesión
          </CardTitle>
          <CardDescription>
            {isConfiguration
              ? "Hay un problema con la configuración del servidor."
              : "Ocurrió un error durante el inicio de sesión."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConfiguration && (
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold mb-2">Verificá estas variables en Vercel → Settings → Environment Variables:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>AUTH_SECRET</strong> o <strong>NEXTAUTH_SECRET</strong> — mínimo 32 caracteres (<code className="bg-amber-100 px-1 rounded">openssl rand -base64 32</code>)</li>
                <li><strong>GOOGLE_CLIENT_ID</strong> y <strong>GOOGLE_CLIENT_SECRET</strong> — desde Google Cloud Console</li>
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
            </div>
          )}
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/auth/signin">Volver a intentar</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Ir al inicio</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
