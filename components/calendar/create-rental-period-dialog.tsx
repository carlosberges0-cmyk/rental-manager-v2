"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { createRentalPeriod } from "@/lib/actions/rental-periods"
import { getTenants } from "@/lib/actions/tenants"
import { useToast } from "@/components/ui/toast"
import { Tenant } from "@prisma/client"
import { format } from "date-fns"
import { Plus } from "lucide-react"
import type { RentalPeriodUI, UnitUI } from "@/lib/ui-types"
import { toRentalPeriodUI } from "@/lib/ui-mappers"

interface CreateRentalPeriodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  units: UnitUI[]
  onSuccess: (period: RentalPeriodUI) => void
}

export function CreateRentalPeriodDialog({
  open,
  onOpenChange,
  units,
  onSuccess,
}: CreateRentalPeriodDialogProps) {
  const [loading, setLoading] = useState(false)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    unitId: units[0]?.id || "",
    tenantId: "",
    tenantName: "", // Nuevo campo para nombre de inquilino como texto libre
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    priceAmount: "",
    currency: "ARS" as const,
    billingFrequency: "MONTHLY" as const,
    status: "ACTIVE" as const,
    notes: "",
    exemptFromIVA: false,
  })

  useEffect(() => {
    if (open) {
      getTenants()
        .then((tenants) => {
          console.log("Tenants loaded:", tenants.length, tenants)
          setTenants(tenants)
        })
        .catch((error) => {
          console.error("Error loading tenants:", error)
          setTenants([])
        })
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const period = await createRentalPeriod({
        ...formData,
        priceAmount: parseFloat(formData.priceAmount),
        tenantId: formData.tenantId || undefined,
        tenantName: formData.tenantName || undefined,
      })
      addToast({ title: "Período creado", description: "El período de alquiler se ha creado correctamente" })
      onSuccess(toRentalPeriodUI(period))
      setFormData({
        unitId: units[0]?.id || "",
        tenantId: "",
        tenantName: "",
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        priceAmount: "",
        currency: "ARS",
        billingFrequency: "MONTHLY",
        status: "ACTIVE",
        notes: "",
        exemptFromIVA: false,
      })
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo crear el período",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Período de Alquiler</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="unitId">Unidad *</Label>
            <Select
              id="unitId"
              value={formData.unitId}
              onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
              required
            >
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tenantName">Inquilino</Label>
            <Input
              id="tenantName"
              type="text"
              value={formData.tenantName}
              onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
              placeholder="Nombre del inquilino (opcional)"
            />
            <p className="text-sm text-gray-500 mt-1">
              Puedes escribir el nombre del inquilino directamente
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Fecha Inicio *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                min={format(new Date(), "yyyy-MM-dd")}
                required
              />
            </div>
            <div>
              <Label htmlFor="endDate">Fecha Fin *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                min={formData.startDate || format(new Date(), "yyyy-MM-dd")}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priceAmount">Precio *</Label>
              <Input
                id="priceAmount"
                type="number"
                step="0.01"
                value={formData.priceAmount}
                onChange={(e) => setFormData({ ...formData, priceAmount: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="currency">Moneda *</Label>
              <Select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
                required
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="billingFrequency">Frecuencia *</Label>
              <Select
                id="billingFrequency"
                value={formData.billingFrequency}
                onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value as any })}
                required
              >
                <option value="MONTHLY">Mensual</option>
                <option value="WEEKLY">Semanal</option>
                <option value="DAILY">Diario</option>
                <option value="ONE_TIME">Una vez</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Estado *</Label>
              <Select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                required
              >
                <option value="RESERVED">Reservado</option>
                <option value="ACTIVE">Activo</option>
                <option value="CANCELLED">Cancelado</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.exemptFromIVA}
                onChange={(e) => setFormData({ ...formData, exemptFromIVA: e.target.checked })}
              />
              <span className="text-sm">Exento de IVA</span>
            </label>
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
