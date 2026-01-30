import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail } from "lucide-react"

const isPreview = process.env.VERCEL_ENV === "preview"

export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-center">Revisa tu email</CardTitle>
          <CardDescription className="text-center">
            Hemos enviado un enlace de acceso a tu dirección de correo electrónico.
            Haz clic en el enlace para iniciar sesión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Si no recibes el email, verifica tu carpeta de spam.
          </p>
          {isPreview && (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 text-center">
              En entornos de preview, si no recibes el email, el enlace puede haberse impreso en los logs del servidor (Vercel → Deployment → Logs).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
