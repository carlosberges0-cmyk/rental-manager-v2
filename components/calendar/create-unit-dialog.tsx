"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { createUnit } from "@/lib/actions/units"
import { useToast } from "@/components/ui/toast"
import { Plus } from "lucide-react"
import type { UnitUI } from "@/lib/ui-types"
import { toUnitUI } from "@/lib/ui-mappers"

interface CreateUnitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (unit: UnitUI) => void
}

export function CreateUnitDialog({ open, onOpenChange, onSuccess }: CreateUnitDialogProps) {
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    type: "DEPTO" as const,
    notes: "",
    ivaRatePercent: "",
    igRatePercent: "",
    iibbRatePercent: "",
    monthlyExpensesAmount: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const unit = await createUnit(formData)
      addToast({ title: "Unidad creada", description: "La unidad se ha creado correctamente" })
      const unitUI = toUnitUI(unit)
      if (unitUI) onSuccess(unitUI)
      setFormData({ 
        name: "", 
        address: "", 
        type: "DEPTO", 
        notes: "",
        ivaRatePercent: "",
        igRatePercent: "",
        iibbRatePercent: "",
        monthlyExpensesAmount: "",
      })
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo crear la unidad",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Unidad</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="type">Tipo *</Label>
            <Select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              required
            >
              <option value="DEPTO">Departamento</option>
              <option value="CASA">Casa</option>
              <option value="COCHERA">Cochera</option>
              <option value="VIVIENDA">Vivienda</option>
              <option value="LOCAL_COMERCIAL">Local Comercial</option>
              <option value="OTRO">Otro</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          
          {/* Tax Rates Section */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Porcentajes de Impuestos a Cobrar (opcional)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ivaRatePercent" className="text-gray-900">IVA %</Label>
                <Input
                  id="ivaRatePercent"
                  type="number"
                  step="0.01"
                  placeholder="21"
                  value={formData.ivaRatePercent}
                  onChange={(e) => setFormData({ ...formData, ivaRatePercent: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="igRatePercent" className="text-gray-900">IG %</Label>
                <Input
                  id="igRatePercent"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={formData.igRatePercent}
                  onChange={(e) => setFormData({ ...formData, igRatePercent: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="iibbRatePercent" className="text-gray-900">IIBB %</Label>
                <Input
                  id="iibbRatePercent"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={formData.iibbRatePercent}
                  onChange={(e) => setFormData({ ...formData, iibbRatePercent: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Estos porcentajes se usarán para calcular automáticamente los impuestos sobre el precio de alquiler.
            </p>
          </div>
          
          {/* Monthly Expenses Section */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Expensas Mensuales (opcional)</h3>
            <div>
              <Label htmlFor="monthlyExpensesAmount" className="text-gray-900">Monto Mensual de Expensas</Label>
              <Input
                id="monthlyExpensesAmount"
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.monthlyExpensesAmount}
                onChange={(e) => setFormData({ ...formData, monthlyExpensesAmount: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-2">
                Este monto se descontará mensualmente en el balance de la unidad.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="flex items-center gap-2"
              style={{ backgroundColor: loading ? undefined : '#1B5E20' }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#2E7D32')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#1B5E20')}
            >
              {loading ? (
                "Creando..."
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Crear
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
