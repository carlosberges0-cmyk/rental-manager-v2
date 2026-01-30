"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { createPayment, updatePayment } from "@/lib/actions/payments"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { useToast } from "@/components/ui/toast"
import { format } from "date-fns"
import type { RentalPeriodUI } from "@/lib/ui-types"
import { toRentalPeriodUI } from "@/lib/ui-mappers"

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  units: Array<{ id: string; name: string }>
  rentalPeriodId?: string
  unitId?: string
  payment?: { id: string; unitId: string; amount: number; currency: string; paymentDate: string | Date; paymentMethod: string; reference?: string; notes?: string; rentalPeriodId?: string }
  rentalPeriods?: RentalPeriodUI[]
  onSuccess: (payment: unknown) => void
}

export function PaymentDialog({
  open,
  onOpenChange,
  units,
  rentalPeriodId,
  unitId,
  payment,
  rentalPeriods: externalRentalPeriods,
  onSuccess,
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [rentalPeriods, setRentalPeriods] = useState<RentalPeriodUI[]>([])
  const { addToast } = useToast()
  type PaymentMethod = "CASH" | "TRANSFER" | "CHECK" | "DEBIT_CARD" | "CREDIT_CARD" | "OTHER"
  const [formData, setFormData] = useState<{
    unitId: string
    rentalPeriodId: string
    amount: string
    currency: "ARS" | "USD"
    paymentDate: string
    paymentMethod: PaymentMethod
    reference: string
    notes: string
  }>({
    unitId: unitId || payment?.unitId || units[0]?.id || "",
    rentalPeriodId: rentalPeriodId || payment?.rentalPeriodId || "",
    amount: payment ? Number(payment.amount).toString() : "",
    currency: (payment?.currency || "ARS") as "ARS" | "USD",
    paymentDate: payment
      ? format(new Date(payment.paymentDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    paymentMethod: (payment?.paymentMethod || "TRANSFER") as PaymentMethod,
    reference: payment?.reference || "",
    notes: payment?.notes || "",
  })

  useEffect(() => {
    if (externalRentalPeriods && externalRentalPeriods.length > 0) {
      setRentalPeriods(externalRentalPeriods)
    } else if (formData.unitId && !externalRentalPeriods) {
      getRentalPeriods(formData.unitId)
        .then((rps) => rps.map((rp) => toRentalPeriodUI(rp)))
        .then(setRentalPeriods)
        .catch((error) => {
          console.error("Error loading rental periods:", error)
          setRentalPeriods([])
        })
    }
  }, [formData.unitId, externalRentalPeriods])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (payment) {
        const updated = await updatePayment(payment.id, {
          ...formData,
          amount: parseFloat(formData.amount),
          rentalPeriodId: formData.rentalPeriodId || undefined,
        })
        addToast({
          title: "Pago actualizado",
          description: "El pago se ha actualizado correctamente",
        })
        onSuccess(updated)
      } else {
        const created = await createPayment({
          ...formData,
          amount: parseFloat(formData.amount),
          rentalPeriodId: formData.rentalPeriodId || undefined,
        })
        addToast({
          title: "Pago registrado",
          description: "El pago se ha registrado correctamente",
        })
        onSuccess(created)
      }
      setFormData({
        unitId: units[0]?.id || "",
        rentalPeriodId: "",
        amount: "",
        currency: "ARS",
        paymentDate: format(new Date(), "yyyy-MM-dd"),
        paymentMethod: "TRANSFER",
        reference: "",
        notes: "",
      })
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo guardar el pago",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const availablePeriods = rentalPeriods.filter(
    (rp) => rp.unitId === formData.unitId && rp.status === "ACTIVE"
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{payment ? "Editar Pago" : "Registrar Pago Recibido"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="unitId">Unidad *</Label>
            <Select
              id="unitId"
              value={formData.unitId}
              onChange={(e) => {
                setFormData({ ...formData, unitId: e.target.value, rentalPeriodId: "" })
              }}
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
            <Label htmlFor="rentalPeriodId">Período de Alquiler (opcional)</Label>
            <Select
              id="rentalPeriodId"
              value={formData.rentalPeriodId}
              onChange={(e) => setFormData({ ...formData, rentalPeriodId: e.target.value })}
            >
              <option value="">Sin período asociado</option>
              {availablePeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {format(new Date(period.startDate), "dd/MM/yyyy")} -{" "}
                  {format(new Date(period.endDate), "dd/MM/yyyy")} -{" "}
                  {period.tenant?.name || "Sin inquilino"}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Monto *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
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
              <Label htmlFor="paymentDate">Fecha de Pago *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="paymentMethod">Método de Pago *</Label>
              <Select
                id="paymentMethod"
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                required
              >
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CHECK">Cheque</option>
                <option value="DEBIT_CARD">Tarjeta Débito</option>
                <option value="CREDIT_CARD">Tarjeta Crédito</option>
                <option value="OTHER">Otro</option>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="reference">Referencia/Comprobante</Label>
            <Input
              id="reference"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Número de comprobante, transferencia, etc."
            />
          </div>

          <div>
            <Label htmlFor="notes">Notas</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : payment ? "Actualizar" : "Registrar Pago"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
