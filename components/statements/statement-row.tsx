"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit, Save, X, Eye } from "lucide-react"
import { computeStatement } from "@/lib/services/statement-calculator"

interface StatementRowProps {
  row: any
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (data: any) => void
  units: any[]
  rentalPeriods: any[]
  periodExpenses?: any[]
  onShowExpenseDetails?: (args: {
    title: string
    expenses: any[]
    manualValue?: number
    currency?: string
  }) => void
  onAlquilerBlur?: (row: any, value: number) => void
}

export function StatementRow({
  row,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  units,
  rentalPeriods,
  periodExpenses = [],
  onShowExpenseDetails,
  onAlquilerBlur,
}: StatementRowProps) {
  const [formData, setFormData] = useState({
    alquiler: row.alquiler || 0,
    osse: row.osse || null,
    inmob: row.inmob || null,
    tsu: row.tsu || null,
    obras: row.obras || null,
    otrosTotal: row.otrosTotal || null,
    expensas: row.expensas || null,
  })
  const [alquilerInput, setAlquilerInput] = useState<string>(() =>
    row.alquiler != null && row.alquiler !== "" ? String(row.alquiler) : ""
  )

  useEffect(() => {
    const v = row.alquiler != null && row.alquiler !== "" ? String(row.alquiler) : ""
    setAlquilerInput(v)
  }, [row.unitId, row.period, row.alquiler])

  useEffect(() => {
    if (isEditing) {
      setFormData({
        alquiler: row.alquiler || 0,
        osse: row.osse || null,
        inmob: row.inmob || null,
        tsu: row.tsu || null,
        obras: row.obras || null,
        otrosTotal: row.otrosTotal || null,
        expensas: row.expensas || null,
      })
    }
  }, [isEditing, row.unitId, row.period, row.alquiler, row.osse, row.inmob, row.tsu, row.obras, row.otrosTotal, row.expensas])

  // Obtener configuración de la unidad
  const unit = units.find(u => u.id === row.unitId)
  const aplicaIvaAlquiler = unit?.aplicaIvaAlquiler ?? false
  const ivaRate = unit?.ivaRatePercent ? unit.ivaRatePercent / 100 : 0.21

  // Calcular totales en tiempo real
  const computed = useMemo(() => {
    return computeStatement({
      alquiler: formData.alquiler || 0,
      osse: formData.osse || undefined,
      inmob: formData.inmob || undefined,
      tsu: formData.tsu || undefined,
      obras: formData.obras || undefined,
      otrosTotal: formData.otrosTotal || undefined,
      expensas: formData.expensas || undefined,
      aplicaIvaAlquiler,
      ivaRate,
    })
  }, [formData, aplicaIvaAlquiler, ivaRate])

  const handleSave = () => {
    onSave({
      ...row,
      ...formData,
      ...computed,
    })
  }

  const handleCancel = () => {
    setFormData({
      alquiler: row.alquiler || 0,
      osse: row.osse || null,
      inmob: row.inmob || null,
      tsu: row.tsu || null,
      obras: row.obras || null,
      otrosTotal: row.otrosTotal || null,
      expensas: row.expensas || null,
    })
    onCancel()
  }

  const groupName = row.unit?.propertyGroup?.name || "Sin Grupo"
  const owner = row.unit?.owner || "-"
  const unitName = row.unit?.name || "-"

  // Filtrar gastos de esta unidad
  const unitExpenses = periodExpenses.filter((e: any) => e.unitId === row.unitId)
  const obrasExpenses = unitExpenses.filter((e: any) => e.category === 'OBRAS')
  const otrosExpenses = unitExpenses.filter((e: any) => e.category === 'OTROS')

  if (isEditing) {
    return (
      <tr className="border-b border-gray-200 bg-blue-50">
        <td className="p-3 text-gray-900 sticky left-0 bg-blue-50 z-10">
          <div className="font-medium">{groupName}</div>
          <div className="text-sm text-gray-600">{owner}</div>
        </td>
        <td className="p-3 text-gray-900 font-medium">{unitName}</td>
        <td className="p-3">
          <Input
            type="number"
            step="0.01"
            value={formData.alquiler || ""}
            onChange={(e) => setFormData({ ...formData, alquiler: parseFloat(e.target.value) || 0 })}
            className="w-24 text-right"
          />
        </td>
        <td className="p-3">
          <Input
            type="number"
            step="0.01"
            value={formData.osse || ""}
            onChange={(e) => setFormData({ ...formData, osse: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-24 text-right"
          />
        </td>
        <td className="p-3">
          <Input
            type="number"
            step="0.01"
            value={formData.inmob || ""}
            onChange={(e) => setFormData({ ...formData, inmob: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-24 text-right"
          />
        </td>
        <td className="p-3">
          <Input
            type="number"
            step="0.01"
            value={formData.tsu || ""}
            onChange={(e) => setFormData({ ...formData, tsu: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-24 text-right"
          />
        </td>
        <td className="p-3">
          <Input
            type="number"
            step="0.01"
            value={formData.obras || ""}
            onChange={(e) => setFormData({ ...formData, obras: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-24 text-right"
          />
        </td>
        <td className="p-3">
          <Input
            type="number"
            step="0.01"
            value={formData.otrosTotal || ""}
            onChange={(e) => setFormData({ ...formData, otrosTotal: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-24 text-right"
          />
        </td>
        <td className="p-3 text-right text-gray-700 font-medium">
          {computed.ivaAlquiler.toLocaleString()}
        </td>
        <td className="p-3 text-right text-gray-900 font-semibold">
          {computed.totalMes.toLocaleString()}
        </td>
        <td className="p-3">
          <Input
            type="number"
            step="0.01"
            value={formData.expensas || ""}
            onChange={(e) => setFormData({ ...formData, expensas: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-24 text-right"
          />
        </td>
        <td className="p-3 text-right text-gray-700 font-medium">
          {computed.neto.toLocaleString()}
        </td>
        <td className="p-3 text-right text-gray-900 font-semibold">
          {computed.neteado.toLocaleString()}
        </td>
        <td className="p-3">
          <div className="flex gap-2 justify-center">
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      <td className="p-3 text-gray-900 sticky left-0 bg-white z-10">
        <div className="font-medium">{groupName}</div>
        <div className="text-sm text-gray-600">{owner}</div>
      </td>
      <td className="p-3 text-gray-900 font-medium">{unitName}</td>
      <td className="p-3">
        <Input
          type="number"
          step="0.01"
          min={0}
          value={alquilerInput}
          onChange={(e) => setAlquilerInput(e.target.value)}
          onBlur={() => {
            const n = alquilerInput === "" ? 0 : parseFloat(alquilerInput)
            const prev = Number(row.alquiler) || 0
            if (!Number.isNaN(n) && n !== prev && onAlquilerBlur) {
              onAlquilerBlur(row, n)
            }
          }}
          className="w-24 text-right h-9"
        />
      </td>
      <td className="p-3 text-right text-gray-700">{row.osse?.toLocaleString() || "-"}</td>
      <td className="p-3 text-right text-gray-700">{row.inmob?.toLocaleString() || "-"}</td>
      <td className="p-3 text-right text-gray-700">{row.tsu?.toLocaleString() || "-"}</td>
      <td className="p-3 text-right text-gray-700">
        {row.obras && row.obras > 0 ? (
          <button
            onClick={() =>
              onShowExpenseDetails?.({
                title: "Gastos de Obras",
                expenses: obrasExpenses,
                manualValue: row.obras,
                currency: row.currency,
              })
            }
            className="hover:underline flex items-center gap-1 ml-auto justify-end"
            title="Ver subgastos"
          >
            {row.obras.toLocaleString()}
            {obrasExpenses.length > 0 && <Eye className="h-3 w-3 text-gray-500" />}
          </button>
        ) : (
          "-"
        )}
      </td>
      <td className="p-3 text-right text-gray-700">
        {row.otrosTotal && row.otrosTotal > 0 ? (
          <button
            onClick={() =>
              onShowExpenseDetails?.({
                title: "Gastos de Otros",
                expenses: otrosExpenses,
                manualValue: row.otrosTotal,
                currency: row.currency,
              })
            }
            className="hover:underline flex items-center gap-1 ml-auto justify-end"
            title="Ver subgastos"
          >
            {row.otrosTotal.toLocaleString()}
            {otrosExpenses.length > 0 && <Eye className="h-3 w-3 text-gray-500" />}
          </button>
        ) : (
          "-"
        )}
      </td>
      <td className="p-3 text-right text-gray-700">{row.ivaAlquiler?.toLocaleString() || "0"}</td>
      <td className="p-3 text-right text-gray-900 font-semibold">{row.totalMes?.toLocaleString() || "0"}</td>
      <td className="p-3 text-right text-gray-700">{row.expensas?.toLocaleString() || "-"}</td>
      <td className="p-3 text-right text-gray-700 font-medium">{row.neto?.toLocaleString() || "0"}</td>
      <td className="p-3 text-right text-gray-900 font-semibold">{row.neteado?.toLocaleString() || "0"}</td>
      <td className="p-3">
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="w-full"
        >
          <Edit className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  )
}
