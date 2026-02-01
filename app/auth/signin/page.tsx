"use client"

import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default function SignInPage() {
  const callbackUrl = "/"
  const signInUrl = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`

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
          <Link
            href={signInUrl}
            className={cn(buttonVariants(), "w-full cursor-pointer bg-[#1B5E20] hover:bg-[#2E7D32]")}
          >
            Continuar con Google
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
