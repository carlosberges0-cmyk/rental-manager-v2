"use client"

import { useState, useEffect } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { updateRentalPeriod, deleteRentalPeriod } from "@/lib/actions/rental-periods"
import { getPayments, deletePayment } from "@/lib/actions/payments"
import { useToast } from "@/components/ui/toast"
import { format } from "date-fns"
import { PaymentDialog } from "@/components/payments/payment-dialog"
import { Plus, Trash2 } from "lucide-react"
import type { RentalPeriodUI } from "@/lib/ui-types"
import { toRentalPeriodUI } from "@/lib/ui-mappers"

interface RentalPeriodDrawerProps {
  rentalPeriod: RentalPeriodUI
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (period: RentalPeriodUI) => void
  onDelete?: (id: string) => void
}

export function RentalPeriodDrawer({
  rentalPeriod,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: RentalPeriodDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState<{ id: string; amount: number; currency: string; paymentDate: string | Date; paymentMethod: string; reference?: string }[]>([])
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    startDate: format(new Date(rentalPeriod.startDate), "yyyy-MM-dd"),
    endDate: format(new Date(rentalPeriod.endDate), "yyyy-MM-dd"),
    priceAmount: Number(rentalPeriod.priceAmount).toString(),
    currency: rentalPeriod.currency,
    billingFrequency: rentalPeriod.billingFrequency,
    status: rentalPeriod.status,
    notes: rentalPeriod.notes || "",
    exemptFromIVA: rentalPeriod.exemptFromIVA,
  })

  useEffect(() => {
    if (open && rentalPeriod.id) {
      loadPayments()
    }
  }, [open, rentalPeriod.id])

  const loadPayments = async () => {
    try {
      const all = await getPayments()
      const list = Array.isArray(all) ? all : []
      const filtered = list.filter(
        (p: { unitId?: string; rentalPeriodId?: string }) =>
          p.unitId === rentalPeriod.unitId && p.rentalPeriodId === rentalPeriod.id
      ) as { id: string; amount: number; currency: string; paymentDate: string | Date; paymentMethod: string; reference?: string }[]
      setPayments(filtered)
    } catch (error) {
      console.error("Error loading payments:", error)
    }
  }

  const handleDeletePayment = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este pago?")) return
    try {
      await deletePayment(id)
      await loadPayments()
      addToast({ title: "Pago eliminado", description: "El pago se ha eliminado correctamente" })
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo eliminar el pago",
        variant: "destructive",
      })
    }
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalAmount = Number(rentalPeriod.priceAmount)
  const remaining = totalAmount - totalPaid

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const updated = await updateRentalPeriod(rentalPeriod.id, {
        startDate: formData.startDate,
        endDate: formData.endDate,
        priceAmount: parseFloat(formData.priceAmount),
        currency: formData.currency as "ARS" | "USD",
        billingFrequency: formData.billingFrequency as "MONTHLY" | "WEEKLY" | "DAILY" | "ONE_TIME",
        status: formData.status as "RESERVED" | "ACTIVE" | "CANCELLED",
        notes: formData.notes || undefined,
        exemptFromIVA: formData.exemptFromIVA,
      })
      const normalized = toRentalPeriodUI(updated)
      addToast({ title: "Actualizado", description: "El período se ha actualizado correctamente" })
      onUpdate(normalized)
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo actualizar el período",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de que deseas eliminar este período de alquiler? Esta acción no se puede deshacer.")) {
      return
    }

    setLoading(true)
    try {
      await deleteRentalPeriod(rentalPeriod.id)
      addToast({ title: "Eliminado", description: "El período de alquiler se ha eliminado correctamente" })
      onOpenChange(false)
      if (onDelete) {
        onDelete(rentalPeriod.id)
      }
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo eliminar el período",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Editar Período de Alquiler</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <Label>Unidad</Label>
            <Input value={rentalPeriod.unit?.name ?? "—"} disabled />
          </div>
          <div>
            <Label>Inquilino</Label>
            <Input value={rentalPeriod.tenant?.name || "Sin inquilino"} disabled />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Fecha Inicio *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
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
          <div className="flex justify-between items-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={loading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                style={{ backgroundColor: '#1B5E20' }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#2E7D32')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#1B5E20')}
              >
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </form>

        {/* Payments Section */}
        <div className="border-t mt-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Pagos Recibidos</h3>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowPaymentDialog(true)}
              style={{ backgroundColor: '#1B5E20' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2E7D32'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1B5E20'}
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Pago
            </Button>
          </div>

          {/* Payment Summary */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">Resumen de Pagos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Monto Total</div>
                  <div className="font-semibold text-lg">
                    {totalAmount.toLocaleString()} {rentalPeriod.currency}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pagado</div>
                  <div className="font-semibold text-lg" style={{ color: '#1B5E20' }}>
                    {totalPaid.toLocaleString()} {rentalPeriod.currency}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pendiente</div>
                  <div 
                    className="font-semibold text-lg" 
                    style={{ color: remaining > 0 ? '#dc2626' : '#1B5E20' }}
                  >
                    {remaining.toLocaleString()} {rentalPeriod.currency}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payments List */}
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay pagos registrados
            </p>
          ) : (
            <div className="space-y-2">
              {payments.map((payment) => (
                <Card key={payment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {Number(payment.amount).toLocaleString()} {payment.currency}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(payment.paymentDate), "dd/MM/yyyy")} - {payment.paymentMethod}
                          {payment.reference && ` - ${payment.reference}`}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePayment(payment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>

      {/* Payment Dialog */}
      {showPaymentDialog && rentalPeriod.unit && (
        <PaymentDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          units={[rentalPeriod.unit]}
          rentalPeriodId={rentalPeriod.id}
          unitId={rentalPeriod.unitId}
          onSuccess={async () => {
            await loadPayments()
            setShowPaymentDialog(false)
          }}
        />
      )}
    </Drawer>
  )
}
