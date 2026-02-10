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

interface PropertyGroupOption {
  id: string
  name: string
}

interface CreateUnitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (unit: UnitUI) => void
  propertyGroups?: PropertyGroupOption[]
}

export function CreateUnitDialog({ open, onOpenChange, onSuccess, propertyGroups = [] }: CreateUnitDialogProps) {
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    type: "DEPTO" as const,
    propertyGroupId: "" as string,
    notes: "",
    ivaRatePercent: "",
    igRatePercent: "",
    iibbRatePercent: "",
    monthlyExpensesAmount: "",
    metrosCuadrados: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const dataToSubmit = {
        ...formData,
        propertyGroupId: formData.propertyGroupId || undefined,
      }
      const unit = await createUnit(dataToSubmit)
      addToast({ title: "Unidad creada", description: "La unidad se ha creado correctamente" })
      const unitUI = toUnitUI(unit)
      if (unitUI) onSuccess(unitUI)
      setFormData({ 
        name: "", 
        address: "", 
        type: "DEPTO", 
        propertyGroupId: "",
        notes: "",
        ivaRatePercent: "",
        igRatePercent: "",
        iibbRatePercent: "",
        monthlyExpensesAmount: "",
        metrosCuadrados: "",
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
          {propertyGroups.length > 0 && (
            <div>
              <Label htmlFor="propertyGroupId">Grupo de propiedades</Label>
              <Select
                id="propertyGroupId"
                value={formData.propertyGroupId}
                onChange={(e) => setFormData({ ...formData, propertyGroupId: e.target.value })}
              >
                <option value="">Sin grupo</option>
                {propertyGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          {/* Superficie */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Superficie (opcional)</h3>
            <div>
              <Label htmlFor="metrosCuadrados" className="text-gray-900">Metros cuadrados (m²)</Label>
              <Input
                id="metrosCuadrados"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={formData.metrosCuadrados}
                onChange={(e) => setFormData({ ...formData, metrosCuadrados: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-2">
                Para calcular ganancia por m² en liquidaciones y BI.
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
