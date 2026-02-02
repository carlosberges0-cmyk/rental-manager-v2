"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignInPage() {
  const signInUrl = `/api/auth/signin/google?callbackUrl=${encodeURIComponent("/")}`

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Usa tu cuenta de Google para acceder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            className="w-full"
            onClick={() => { window.location.href = signInUrl }}
          >
            Continuar con Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
