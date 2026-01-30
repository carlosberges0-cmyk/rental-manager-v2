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
        setError(
          "No se pudo completar el envío. Revisá los logs del servidor (Vercel → Deployment → Logs): deberías ver [AUTH EMAIL CONFIG] y [AUTH MAGIC LINK] con el enlace para iniciar sesión. Si no aparecen, verifica la conexión a la base de datos."
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
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar enlace de acceso"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
