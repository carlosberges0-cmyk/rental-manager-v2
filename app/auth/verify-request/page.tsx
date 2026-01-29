import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail } from "lucide-react"

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
        </CardContent>
      </Card>
    </div>
  )
}
