"use client"

import { useEffect } from "react"
import { signIn } from "next-auth/react"

export default function SignInPage() {
  // Warm-up: evita que la primera petición OAuth falle por cold start en Vercel.
  // Al cargar la página, hacemos una petición que "calienta" las rutas de auth.
  useEffect(() => {
    fetch("/api/auth/csrf").catch(() => {})
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
        style={{ color: "#111827" }}
      >
        <h2 className="text-2xl font-semibold mb-1" style={{ color: "#111827" }}>
          Iniciar sesión
        </h2>
        <p className="text-sm mb-6" style={{ color: "#4b5563" }}>
          Usa tu cuenta de Google para acceder
        </p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="block w-full rounded-md px-4 py-2.5 text-center text-sm font-medium transition-colors"
          style={{
            backgroundColor: "#1B5E20",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Continuar con Google
        </button>
      </div>
    </div>
  )
}
