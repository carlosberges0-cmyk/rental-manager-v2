"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { RentalPeriod, MonthlyExpense } from "@prisma/client"
import { format } from "date-fns"
import * as XLSX from "xlsx"

interface ExportPageProps {
  taxData: any
  rentalPeriods: (RentalPeriod & { unit: { name: string }; tenant: { name: string } | null })[]
  expenses: (MonthlyExpense & { unit: { name: string } })[]
}

export function ExportPage({ taxData, rentalPeriods, expenses }: ExportPageProps) {
  const [loading, setLoading] = useState(false)

  const exportMonthlySummary = () => {
    setLoading(true)

    const months = Object.keys(taxData.incomeByMonth).sort()
    const data = months.map((month) => {
      const income = taxData.incomeByMonth[month] || 0
      const expenseData = taxData.expensesByMonth[month] || { total: 0, deductible: 0 }
      const net = income - expenseData.total
      const iva = taxData.ivaAmount * (income / taxData.income) || 0
      const iibb = taxData.iibbAmount * (income / taxData.income) || 0
      const ig = taxData.igEstimate * (net / taxData.netResult) || 0

      return {
        Mes: month,
        "Ingresos Brutos": income.toFixed(2),
        "Gastos Deducibles": expenseData.deductible.toFixed(2),
        "Gastos No Deducibles": (expenseData.total - expenseData.deductible).toFixed(2),
        "Resultado Neto": net.toFixed(2),
        IVA: iva.toFixed(2),
        IIBB: iibb.toFixed(2),
        "IG (Estimación)": ig.toFixed(2),
      }
    })

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Resumen Mensual")
    XLSX.writeFile(wb, `resumen-mensual-${new Date().getFullYear()}.xlsx`)

    setLoading(false)
  }

  const exportDetailedExpenses = () => {
    setLoading(true)

    const data = expenses.map((expense) => ({
      Mes: expense.month,
      Unidad: expense.unit.name,
      Categoría: expense.category,
      Descripción: expense.description,
      Monto: Number(expense.amount).toFixed(2),
      Moneda: expense.currency,
      Deducible: expense.deductibleFlag ? "Sí" : "No",
      Vendor: expense.vendor || "",
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Gastos Detallados")
    XLSX.writeFile(wb, `gastos-detallados-${new Date().getFullYear()}.xlsx`)

    setLoading(false)
  }

  const exportRentalPeriods = () => {
    setLoading(true)

    const data = rentalPeriods.map((period) => ({
      Unidad: period.unit.name,
      Inquilino: period.tenant?.name || "Sin inquilino",
      "Fecha Inicio": format(new Date(period.startDate), "dd/MM/yyyy"),
      "Fecha Fin": format(new Date(period.endDate), "dd/MM/yyyy"),
      Precio: Number(period.priceAmount).toFixed(2),
      Moneda: period.currency,
      Frecuencia: period.billingFrequency,
      Estado: period.status,
      Notas: period.notes || "",
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Períodos de Alquiler")
    XLSX.writeFile(wb, `periodos-alquiler-${new Date().getFullYear()}.xlsx`)

    setLoading(false)
  }

  const exportCSV = (data: any[], filename: string) => {
    const headers = Object.keys(data[0] || {})
    const csv = [
      headers.join(","),
      ...data.map((row) => headers.map((h) => row[h] || "").join(",")),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Exportar Datos</h1>
      <p className="text-muted-foreground mb-6">
        Exporta tus datos en formato Excel o CSV para compartir con tu contador.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumen Mensual</CardTitle>
            <CardDescription>
              Ingresos, gastos, neto e impuestos por mes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={exportMonthlySummary}
              disabled={loading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos Detallados</CardTitle>
            <CardDescription>
              Lista completa de gastos con categorías y deducibilidad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={exportDetailedExpenses}
              disabled={loading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Períodos de Alquiler</CardTitle>
            <CardDescription>
              Lista completa de períodos de alquiler con precios y fechas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={exportRentalPeriods}
              disabled={loading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
