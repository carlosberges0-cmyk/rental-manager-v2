"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, X, DollarSign } from "lucide-react"
import { markPaymentReceived, getPaymentsStatusByPeriod } from "@/lib/actions/payments"
import { useToast } from "@/components/ui/toast"
import type { UnitUI } from "@/lib/ui-types"
import { format, parse } from "date-fns"
import { useRouter } from "next/navigation"

interface PaymentsPageProps {
  units: UnitUI[]
}

export function PaymentsPage({ units }: PaymentsPageProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const today = new Date()
    return format(today, "yyyy-MM")
  })
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const { addToast } = useToast()
  const router = useRouter()

  // Función para cargar estados de pagos
  const loadPaymentStatuses = async () => {
    try {
      const statuses = await getPaymentsStatusByPeriod(selectedPeriod)
      const statusMap: Record<string, boolean> = {}
      statuses.forEach((status: { unitId: string; received: boolean }) => {
        statusMap[status.unitId] = status.received
      })
      setPaymentStatuses(statusMap)
    } catch (error) {
      console.error("Error loading payment statuses:", error)
    }
  }

  // Cargar estados de pagos al cambiar el período o al montar el componente
  useEffect(() => {
    loadPaymentStatuses()
  }, [selectedPeriod])

  // Recargar cuando la ventana vuelve a estar activa (cuando cambias de pestaña y vuelves)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadPaymentStatuses()
      }
    }

    const handleFocus = () => {
      loadPaymentStatuses()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [selectedPeriod])

  const handleTogglePayment = async (unitId: string, received: boolean) => {
    setLoading({ ...loading, [unitId]: true })
    try {
      await markPaymentReceived({
        unitId,
        period: selectedPeriod,
        received,
      })

      // Recargar estados desde el servidor para asegurar que se guardó correctamente
      await loadPaymentStatuses()

      addToast({
        title: received ? "Pago marcado como recibido" : "Pago marcado como no recibido",
        description: received
          ? "El pago se ha registrado y actualizado las liquidaciones"
          : "El pago se ha eliminado de las liquidaciones",
      })

      router.refresh()
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado del pago",
        variant: "destructive",
      })
    } finally {
      setLoading({ ...loading, [unitId]: false })
    }
  }

  // Agrupar unidades por grupo de propiedades
  const unitsByGroup = units.reduce((acc, unit) => {
    const groupName = (unit as any).propertyGroup?.name || "Sin Grupo"
    if (!acc[groupName]) {
      acc[groupName] = []
    }
    acc[groupName].push(unit)
    return acc
  }, {} as Record<string, typeof units>)

  const groups = Object.keys(unitsByGroup).sort()

  return (
    <div className="container mx-auto p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#F1F8F4] rounded-lg">
            <DollarSign className="h-8 w-8 text-[#1B5E20]" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[#1B5E20]">Pagos Recibidos</h1>
            <p className="text-gray-600 mt-1">Marca los pagos recibidos por mes y unidad</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="period" className="text-gray-700 font-semibold">
              Período:
            </Label>
            <Input
              id="period"
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-40 border-2 border-[#d4e6dc] focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] transition-all duration-200 rounded-md shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="h-1 bg-gradient-to-r from-[#1B5E20] via-[#2E7D32] to-[#4CAF50] rounded-full"></div>
      </div>

      {/* Units by Group */}
      {groups.map((groupName) => (
        <Card key={groupName} className="mb-6 border-2 border-[#d4e6dc] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#F1F8F4] to-[#E8F5E9] border-b-2 border-[#4CAF50]">
            <CardTitle className="text-2xl font-bold text-[#1B5E20]">
              {groupName}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unitsByGroup[groupName].map((unit) => {
                const isReceived = paymentStatuses[unit.id] || false
                const isLoading = loading[unit.id] || false

                return (
                  <Card
                    key={unit.id}
                    className={`border-2 transition-all duration-200 ${
                      isReceived
                        ? "border-[#4CAF50] bg-[#F1F8F4]"
                        : "border-[#d4e6dc] bg-white"
                    } hover:shadow-lg`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-[#1B5E20]">{unit.name}</h3>
                          <p className="text-sm text-gray-600">{unit.type}</p>
                        </div>
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                            isReceived
                              ? "bg-[#4CAF50] text-white"
                              : "bg-gray-200 text-gray-400"
                          }`}
                        >
                          {isReceived ? (
                            <Check className="h-6 w-6" />
                          ) : (
                            <X className="h-6 w-6" />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {isReceived ? "Pago recibido" : "Pago pendiente"}
                        </span>
                        <Button
                          onClick={() => handleTogglePayment(unit.id, !isReceived)}
                          disabled={isLoading}
                          className={`${
                            isReceived
                              ? "bg-red-500 hover:bg-red-600 text-white"
                              : "bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                          } transition-all duration-200`}
                        >
                          {isLoading
                            ? "Procesando..."
                            : isReceived
                            ? "Marcar como no recibido"
                            : "Marcar como recibido"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Summary */}
      <Card className="mt-6 border-2 border-[#d4e6dc] shadow-lg">
        <CardHeader className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] text-white">
          <CardTitle className="text-xl font-bold">Resumen del Período</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-[#1B5E20]">{units.length}</div>
              <div className="text-sm text-gray-600 mt-1">Total Unidades</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#4CAF50]">
                {Object.values(paymentStatuses).filter(Boolean).length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Pagos Recibidos</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-500">
                {units.length - Object.values(paymentStatuses).filter(Boolean).length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Pagos Pendientes</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
