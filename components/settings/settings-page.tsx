"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateTaxProfile } from "@/lib/actions/taxes"
import { useToast } from "@/components/ui/toast"
import { TaxProfile } from "@prisma/client"

interface SettingsPageProps {
  initialTaxProfile: TaxProfile
}

export function SettingsPage({ initialTaxProfile }: SettingsPageProps) {
  const [loading, setLoading] = useState(false)
  const [taxProfile, setTaxProfile] = useState(initialTaxProfile)
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    ivaEnabled: taxProfile.ivaEnabled,
    ivaRatePercent: Number(taxProfile.ivaRatePercent),
    iibbEnabled: taxProfile.iibbEnabled,
    iibbRatePercent: Number(taxProfile.iibbRatePercent),
    igEstimatePercent: Number(taxProfile.igEstimatePercent),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const updated = await updateTaxProfile(formData)
      setTaxProfile(updated)
      addToast({ title: "Configuración guardada", description: "Los cambios se han guardado correctamente" })
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo guardar la configuración",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Configuración</h1>

      <Card>
        <CardHeader>
          <CardTitle>Perfil Fiscal</CardTitle>
          <CardDescription>
            Configura los porcentajes de impuestos. Los cálculos son orientativos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* IVA Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ivaEnabled"
                  checked={formData.ivaEnabled}
                  onChange={(e) =>
                    setFormData({ ...formData, ivaEnabled: e.target.checked })
                  }
                />
                <Label htmlFor="ivaEnabled" className="text-lg font-semibold">
                  IVA Habilitado
                </Label>
              </div>
              {formData.ivaEnabled && (
                <div>
                  <Label htmlFor="ivaRatePercent">Tasa de IVA (%)</Label>
                  <Input
                    id="ivaRatePercent"
                    type="number"
                    step="0.01"
                    value={formData.ivaRatePercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ivaRatePercent: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              )}
            </div>

            {/* IIBB Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="iibbEnabled"
                  checked={formData.iibbEnabled}
                  onChange={(e) =>
                    setFormData({ ...formData, iibbEnabled: e.target.checked })
                  }
                />
                <Label htmlFor="iibbEnabled" className="text-lg font-semibold">
                  IIBB Habilitado
                </Label>
              </div>
              {formData.iibbEnabled && (
                <div>
                  <Label htmlFor="iibbRatePercent">Tasa de IIBB (%)</Label>
                  <Input
                    id="iibbRatePercent"
                    type="number"
                    step="0.01"
                    value={formData.iibbRatePercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        iibbRatePercent: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              )}
            </div>

            {/* IG Section */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="igEstimatePercent" className="text-lg font-semibold">
                  Impuesto a las Ganancias - Estimación (%)
                </Label>
                <Input
                  id="igEstimatePercent"
                  type="number"
                  step="0.01"
                  value={formData.igEstimatePercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      igEstimatePercent: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Este es un cálculo estimativo. Consulta con tu contador.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando..." : "Guardar Configuración"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
