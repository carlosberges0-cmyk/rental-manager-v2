"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md border-gray-200 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-gray-900">Iniciar sesión</CardTitle>
          <CardDescription className="text-gray-600">
            Usa tu cuenta de Google para acceder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            className="w-full text-white"
            style={{ backgroundColor: "#1B5E20" }}
            onClick={() => signIn("google", { callbackUrl: "/" })}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#2E7D32" }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#1B5E20" }}
          >
            Continuar con Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
