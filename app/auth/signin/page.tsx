"use client"

import { signIn } from "next-auth/react"

export default function SignInPage() {
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
          className="w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor: "#1B5E20",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#2E7D32"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#1B5E20"
          }}
        >
          Continuar con Google
        </button>
      </div>
    </div>
  )
}
