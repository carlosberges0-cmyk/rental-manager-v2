"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn("email", {
        email,
        callbackUrl: "/calendar",
        redirect: false,
      })

      if (!result) {
        setError("No se pudo iniciar el login. Intenta de nuevo.")
        return
      }

      if (result.error) {
        const errorDetail = result.error
        setError(
          `Error: ${errorDetail}. Abrí /api/auth/diagnose para ver el diagnóstico (DB, env vars).`
        )
        return
      }

      if (result.url) {
        // Usually takes you to /auth/verify-request
        router.push(result.url)
        return
      }

      router.push("/auth/verify-request")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Ingresa tu email para recibir un enlace de acceso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error ? (
              <div className="space-y-3">
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </div>
                <p className="text-xs text-muted-foreground">
                  <a
                    href="/api/auth/diagnose"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-primary"
                  >
                    Abrir diagnóstico
                  </a>{" "}
                  para ver el estado de la DB y variables de entorno.
                </p>
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar enlace de acceso"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <a
                href="/api/auth/diagnose"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                Abrir diagnóstico (DB y env)
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
