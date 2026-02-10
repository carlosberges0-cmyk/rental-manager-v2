"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2 } from "lucide-react"
import { createExpense, deleteExpense, updateExpense } from "@/lib/actions/expenses"
import { useToast } from "@/components/ui/toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns"
import type { ExpenseUI, UnitWithRentalPeriodsUI, RentalPeriodUI } from "@/lib/ui-types"
import { toExpenseUI } from "@/lib/ui-mappers"

interface ExpensesListProps {
  initialExpenses: ExpenseUI[]
  units: UnitWithRentalPeriodsUI[]
  rentalPeriods?: RentalPeriodUI[]
}

const categoryLabels: Record<string, string> = {
  OSSE: "OSSE",
  INMOB: "Inmob",
  TSU: "TSU",
  OBRAS: "Obras",
  OTROS: "Otros",
}

export function ExpensesList({ initialExpenses, units, rentalPeriods = [] }: ExpensesListProps) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [showCreate, setShowCreate] = useState(false)
  const [editingExpense, setEditingExpense] = useState<(typeof initialExpenses)[0] | null>(null)
  const { addToast } = useToast()
  const router = useRouter()

  // Update expenses when initialExpenses changes (from server refresh)
  useEffect(() => {
    setExpenses(initialExpenses)
  }, [initialExpenses])

  // Filter units that have rental periods
  const unitsWithRentals = useMemo(() => {
    return units.filter(unit => 
      unit.rentalPeriods && unit.rentalPeriods.length > 0
    )
  }, [units])

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este gasto?")) return

    try {
      await deleteExpense(id)
      setExpenses(expenses.filter((e) => e.id !== id))
      addToast({ title: "Gasto eliminado", description: "El gasto se ha eliminado correctamente" })
      router.refresh() // Refresh to update server data
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo eliminar el gasto",
        variant: "destructive",
      })
    }
  }

  const handleUpdate = (expense: ExpenseUI, updatedFromApi: unknown) => {
    const updated = toExpenseUI(updatedFromApi)
    setExpenses(expenses.map((e) => (e.id === updated.id ? updated : e)))
    setEditingExpense(null)
    addToast({ title: "Gasto actualizado", description: "El gasto se ha actualizado correctamente" })
    router.refresh()
  }

  // Calculate balance for current month
  const currentMonth = new Date().toISOString().slice(0, 7)
  const currentMonthDate = new Date()
  const monthStart = startOfMonth(currentMonthDate)
  const monthEnd = endOfMonth(currentMonthDate)

  const balanceByUnit = useMemo(() => {
    const balance: Record<string, {
      unit: UnitWithRentalPeriodsUI
      income: number
      manualExpenses: number  // Gastos manuales (no EXPENSAS)
      expensas: number        // Solo categoría EXPENSAS
      unitMonthlyExpenses: number // Expensas mensuales de la unidad
      calculatedTaxes: number // Impuestos calculados del precio de alquiler
      net: number
      currency: string
      expensesList: ExpenseUI[]
    }> = {}

    // First, get unit tax rates
    units.forEach(unit => {
      if (!balance[unit.id]) {
        balance[unit.id] = {
          unit,
          income: 0,
          manualExpenses: 0,
          expensas: 0,
          unitMonthlyExpenses: 0,
          calculatedTaxes: 0,
          net: 0,
          currency: "ARS",
          expensesList: [],
        }
      }
      
      // Add unit's monthly expenses
      const monthlyExpenses = unit.monthlyExpensesAmount != null ? Number(unit.monthlyExpensesAmount) : 0
      balance[unit.id].unitMonthlyExpenses = monthlyExpenses
    })

    // Calculate income from rental periods and taxes on income
    rentalPeriods?.forEach(period => {
      if (period.status === "CANCELLED") return
      
      const periodStart = new Date(period.startDate)
      const periodEnd = new Date(period.endDate)
      
      // Check if period overlaps with current month
      const periodOverlapsMonth = 
        (periodStart <= monthEnd && periodEnd >= monthStart)
      
      if (!periodOverlapsMonth) {
        return
      }

      const unitId = period.unitId
      const unit = units.find(u => u.id === unitId)
      const unitForBalance = unit ?? (period.unit ? { ...period.unit, rentalPeriods: [] } : null)
      if (!unitForBalance) return
      
      if (!balance[unitId]) {
        balance[unitId] = {
          unit: unitForBalance,
          income: 0,
          manualExpenses: 0,
          expensas: 0,
          unitMonthlyExpenses: 0,
          calculatedTaxes: 0,
          net: 0,
          currency: period.currency,
          expensesList: [],
        }
      }
      
      // Always update unit's monthly expenses from the units array (most up-to-date)
      const unitFromList = units.find(u => u.id === unitId)
      if (unitFromList) {
        const monthlyExpenses = unitFromList.monthlyExpensesAmount != null ? Number(unitFromList.monthlyExpensesAmount) : 0
        balance[unitId].unitMonthlyExpenses = monthlyExpenses
      } else if (unit) {
        // Fallback to unit from period if not found in units list
        const monthlyExpenses = unit.monthlyExpensesAmount != null ? Number(unit.monthlyExpensesAmount) : 0
        balance[unitId].unitMonthlyExpenses = monthlyExpenses
      }

      // Calculate monthly income based on billing frequency
      const periodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
      const daysInMonth = monthEnd.getDate()
      
      let monthlyIncome = 0
      const priceAmount = typeof period.priceAmount === 'number' ? period.priceAmount : Number(period.priceAmount)
      
      if (period.billingFrequency === "MONTHLY") {
        monthlyIncome = priceAmount
      } else if (period.billingFrequency === "WEEKLY") {
        monthlyIncome = priceAmount * 4.33 // Average weeks per month
      } else if (period.billingFrequency === "DAILY") {
        monthlyIncome = priceAmount * daysInMonth
      } else if (period.billingFrequency === "ONE_TIME") {
        monthlyIncome = 0 // One-time payments not included in monthly
      }

      balance[unitId].income = Number(balance[unitId].income) + Number(monthlyIncome)
      balance[unitId].currency = period.currency

      // Calculate taxes on income using unit's tax rates (unless exempt from IVA)
      if (unit && !period.exemptFromIVA) {
        const ivaRate = unit.ivaRatePercent != null ? Number(unit.ivaRatePercent) / 100 : 0
        const igRate = unit.igRatePercent != null ? Number(unit.igRatePercent) / 100 : 0
        const iibbRate = unit.iibbRatePercent != null ? Number(unit.iibbRatePercent) / 100 : 0

        const ivaAmount = monthlyIncome * ivaRate
        const igAmount = monthlyIncome * igRate
        const iibbAmount = monthlyIncome * iibbRate

        balance[unitId].calculatedTaxes = Number(balance[unitId].calculatedTaxes) + Number(ivaAmount + igAmount + iibbAmount)
      }
    })

    // Separate expenses: manual expenses vs expensas
    expenses.forEach(expense => {
      if (expense.month !== currentMonth) return
      
      const unitId = expense.unitId
      const unitForExpense = units.find(u => u.id === unitId) ?? (expense.unit ? { ...expense.unit, rentalPeriods: [] } : null)
      if (!unitForExpense) return
      
      if (!balance[unitId]) {
        balance[unitId] = {
          unit: unitForExpense,
          income: 0,
          manualExpenses: 0,
          expensas: 0,
          unitMonthlyExpenses: 0,
          calculatedTaxes: 0,
          net: 0,
          currency: expense.currency,
          expensesList: [],
        }
      }
      
      // Always update unit's monthly expenses from the units array (most up-to-date)
      const unitFromList = units.find(u => u.id === unitId)
      if (unitFromList) {
        const monthlyExpenses = unitFromList.monthlyExpensesAmount != null ? Number(unitFromList.monthlyExpensesAmount) : 0
        balance[unitId].unitMonthlyExpenses = monthlyExpenses
      } else if (expense.unit) {
        const monthlyExpenses = expense.unit.monthlyExpensesAmount != null ? Number(expense.unit.monthlyExpensesAmount) : 0
        balance[unitId].unitMonthlyExpenses = monthlyExpenses
      }

      // Ensure baseAmount is a number, not a string
      const baseAmount = typeof expense.amount === 'number' ? expense.amount : Number(expense.amount) || 0

      // All manual expenses go to manualExpenses (no EXPENSAS category anymore)
      balance[unitId].manualExpenses = Number(balance[unitId].manualExpenses) + Number(baseAmount)
      
      // Add expense to the list for this unit
      balance[unitId].expensesList.push(expense)
    })

    // Calculate net for each unit (including unit's monthly expenses) - ensure all are numbers
    // Also, ensure monthly expenses are taken from the most up-to-date units array
    Object.keys(balance).forEach(unitId => {
      // Always get the latest monthly expenses from the units array
      const unitFromList = units.find(u => u.id === unitId)
      if (unitFromList) {
        const monthlyExpenses = unitFromList.monthlyExpensesAmount != null ? Number(unitFromList.monthlyExpensesAmount) : 0
        balance[unitId].unitMonthlyExpenses = monthlyExpenses
      }
      
      balance[unitId].income = Number(balance[unitId].income) || 0
      balance[unitId].manualExpenses = Number(balance[unitId].manualExpenses) || 0
      balance[unitId].expensas = Number(balance[unitId].expensas) || 0
      balance[unitId].unitMonthlyExpenses = Number(balance[unitId].unitMonthlyExpenses) || 0
      balance[unitId].calculatedTaxes = Number(balance[unitId].calculatedTaxes) || 0
      
      // Calculate deductible expenses for this unit
      const deductibleExpenses = balance[unitId].expensesList
        .filter(e => e.deductibleFlag)
        .reduce((sum, e) => {
          const amount = typeof e.amount === 'number' ? e.amount : Number(e.amount) || 0
          return sum + amount
        }, 0)
      
      // Net = ingreso - gastos - expensas - impuestos + gastos deducibles
      // gastos = manualExpenses + unitMonthlyExpenses
      const totalGastos = balance[unitId].manualExpenses + balance[unitId].unitMonthlyExpenses
      balance[unitId].net = balance[unitId].income - totalGastos - balance[unitId].expensas - balance[unitId].calculatedTaxes + deductibleExpenses
    })

    return balance
  }, [rentalPeriods, expenses, units, currentMonth, monthStart, monthEnd])

  return (
    <div className="container mx-auto p-6 bg-white min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gastos Mensuales</h1>
          <p className="text-gray-600 mt-1">Gestión de gastos, expensas e impuestos por unidad</p>
        </div>
        <Button 
          onClick={() => setShowCreate(true)}
          style={{ backgroundColor: '#1B5E20' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2E7D32'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1B5E20'}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Gasto
        </Button>
      </div>

      {/* Balance Section */}
      {Object.keys(balanceByUnit).length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#1B5E20] mb-4">Balance del Mes ({currentMonth})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(balanceByUnit).filter(b => b.income > 0 || b.manualExpenses > 0 || b.expensas > 0 || b.expensesList.length > 0).map((balance) => (
              <Card key={balance.unit.id} className="border border-[#d4e6dc] shadow-sm">
                <CardHeader className="bg-[#F1F8F4] border-b border-[#d4e6dc]">
                  <CardTitle className="text-lg font-semibold text-[#1B5E20]">{balance.unit.name}</CardTitle>
                  <CardDescription className="text-sm text-gray-600">Balance mensual</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    {/* Ingresos */}
                    <div className="flex justify-between items-center pb-2 border-b-2 border-[#1B5E20]">
                      <span className="text-sm font-semibold text-gray-900">Ingresos (Alquiler):</span>
                      <span className="font-bold text-[#1B5E20]">
                        {balance.income.toLocaleString()} {balance.currency}
                      </span>
                    </div>
                    
                    {/* Gastos separados */}
                    <div className="space-y-2 pl-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Gastos manuales:</span>
                        <span className="font-medium text-gray-800">
                          -{balance.manualExpenses.toLocaleString()} {balance.currency}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Expensas (categoría):</span>
                        <span className="font-medium text-gray-800">
                          -{balance.expensas.toLocaleString()} {balance.currency}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Expensas mensuales (unidad):</span>
                        <span className="font-medium text-gray-800">
                          -{balance.unitMonthlyExpenses.toLocaleString()} {balance.currency}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Impuestos (IG/IVA/IIBB):</span>
                        <span className="font-medium text-gray-800">
                          -{balance.calculatedTaxes.toLocaleString()} {balance.currency}
                        </span>
                      </div>
                    </div>
                    
                    {/* Neto */}
                    <div className="border-t-2 border-[#1B5E20] pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg text-gray-900">Neto:</span>
                        <span className={`font-bold text-xl ${balance.net >= 0 ? 'text-[#1B5E20]' : 'text-red-600'}`}>
                          {balance.net.toLocaleString()} {balance.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Lista de gastos dentro del balance */}
                  {balance.expensesList.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-[#1B5E20] mb-2">Gastos registrados:</h4>
                      <div className="space-y-2">
                        {balance.expensesList.map((expense) => (
                          <div key={expense.id} className="flex items-start justify-between p-2 bg-gray-50 rounded border border-gray-200">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-[#1B5E20]">{categoryLabels[expense.category]}</span>
                                <span className="text-xs text-gray-500">•</span>
                                <span className="text-xs text-gray-500">{expense.date ? format(new Date(expense.date), "dd/MM/yyyy") : "-"}</span>
                              </div>
                              <p className="text-sm text-gray-700 mt-1">{expense.description}</p>
                              {expense.vendor && (
                                <p className="text-xs text-gray-500 mt-1">Vendor: {expense.vendor}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <span className="text-sm font-semibold text-[#1B5E20]">
                                {Number(expense.amount).toLocaleString()} {expense.currency}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setEditingExpense(expense)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-600 hover:text-red-700"
                                onClick={() => handleDelete(expense.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Solo mostrar gastos de otros meses fuera del balance */}
      {expenses.filter(e => e.month !== currentMonth).length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-[#1B5E20] mb-4">Gastos de Otros Meses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expenses.filter(e => e.month !== currentMonth).map((expense) => {
              const baseAmount = expense.amount || 0

              return (
                <Card key={expense.id} className="border border-[#d4e6dc]">
                  <CardHeader className="pb-3 bg-[#F1F8F4] border-b border-[#d4e6dc]">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold text-[#1B5E20]">{expense.unit?.name ?? "-"}</CardTitle>
                        <CardDescription className="text-sm text-gray-600 mt-1">
                          {categoryLabels[expense.category]} • {expense.month}
                        </CardDescription>
                        <CardDescription className="text-xs text-gray-500 mt-1">
                          {expense.date ? format(new Date(expense.date), "dd/MM/yyyy") : "-"}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingExpense(expense)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <p className="text-sm text-gray-700 mb-3 font-medium">{expense.description}</p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Monto:</span>
                        <span className="font-bold text-lg text-[#1B5E20]">
                          {baseAmount.toLocaleString()} {expense.currency}
                        </span>
                      </div>
                      
                      {expense.vendor && (
                        <div className="text-xs text-gray-500 mt-2">
                          Vendor: {expense.vendor}
                        </div>
                      )}
                      
                      {expense.deductibleFlag && (
                        <div className="inline-block mt-2 px-2 py-1 text-xs rounded" style={{ backgroundColor: '#E8F5E9', color: '#1B5E20' }}>
                          ✓ Deducible
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {expenses.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No hay gastos registrados</p>
          <Button 
            onClick={() => setShowCreate(true)}
            style={{ backgroundColor: '#1B5E20' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2E7D32'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1B5E20'}
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear primer gasto
          </Button>
        </div>
      )}

      {showCreate && (
        <ExpenseDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          units={units}
          onSuccess={(expense) => {
            setExpenses([toExpenseUI(expense), ...expenses])
            setShowCreate(false)
            router.refresh() // Refresh to update server data
          }}
        />
      )}

      {editingExpense && (
        <ExpenseDialog
          expense={editingExpense}
          open={!!editingExpense}
          onOpenChange={(open) => !open && setEditingExpense(null)}
          units={units}
          onSuccess={(updated) => {
            handleUpdate(editingExpense, updated)
          }}
        />
      )}
    </div>
  )
}

function ExpenseDialog({
  expense,
  open,
  onOpenChange,
  units,
  onSuccess,
}: {
  expense?: ExpenseUI
  open: boolean
  onOpenChange: (open: boolean) => void
  units: UnitWithRentalPeriodsUI[]
  onSuccess: (data: ExpenseUI) => void
}) {
  type ExpenseCategory = "OSSE" | "INMOB" | "TSU" | "OBRAS" | "OTROS"
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()
  
  const baseDate = expense?.date ? new Date(expense.date) : new Date()
  const calculateMonthFromDate = (dateStr: string) => {
    if (!dateStr) return format(new Date(), "yyyy-MM")
    const date = new Date(dateStr)
    return format(date, "yyyy-MM")
  }
  
  const [formData, setFormData] = useState<{
    unitId: string
    month: string
    date: string
    category: ExpenseCategory
    description: string
    amount: string
    currency: "ARS" | "USD"
    deductibleFlag: boolean
    paidByTenant: boolean
    vendor: string
  }>({
    unitId: expense?.unitId || units[0]?.id || "",
    month: expense?.month || calculateMonthFromDate(expense?.date ? format(new Date(expense.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")),
    date: format(baseDate, "yyyy-MM-dd"),
    category: (expense?.category as ExpenseCategory) || "OTROS",
    description: expense?.description || "",
    amount: expense ? Number(expense.amount).toString() : "",
    currency: (expense?.currency as "ARS" | "USD") || "ARS",
    deductibleFlag: expense?.deductibleFlag || false,
    paidByTenant: expense?.paidByTenant ?? false,
    vendor: expense?.vendor || "",
  })
  
  // Actualizar el mes automáticamente cuando cambia la fecha
  const handleDateChange = (newDate: string) => {
    const calculatedMonth = calculateMonthFromDate(newDate)
    setFormData({ ...formData, date: newDate, month: calculatedMonth })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const dataToSubmit = {
        ...formData,
        amount: parseFloat(formData.amount),
      }

      if (expense) {
        const updated = await updateExpense(expense.id, dataToSubmit)
        onSuccess(toExpenseUI(updated))
      } else {
        const created = await createExpense(dataToSubmit)
        onSuccess(toExpenseUI(created))
      }
      addToast({
        title: expense ? "Gasto actualizado" : "Gasto creado",
        description: "El gasto se ha guardado correctamente",
      })
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo guardar el gasto",
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
          <DialogTitle className="text-gray-900">{expense ? "Editar Gasto" : "Nuevo Gasto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="unitId" className="text-gray-900">Unidad *</Label>
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
            <Label htmlFor="date" className="text-gray-900">Fecha del gasto *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleDateChange(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              El mes se calculará automáticamente desde la fecha seleccionada
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category" className="text-gray-900">Categoría *</Label>
              <Select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                required
              >
                <option value="OSSE">OSSE</option>
                <option value="INMOB">Inmob</option>
                <option value="TSU">TSU</option>
                <option value="OBRAS">Obras</option>
                <option value="OTROS">Otros</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="currency" className="text-gray-900">Moneda *</Label>
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
          
          <div>
            <Label htmlFor="description" className="text-gray-900">Descripción *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="amount" className="text-gray-900">Monto *</Label>
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
            <Label htmlFor="vendor" className="text-gray-900">Vendor</Label>
            <Input
              id="vendor"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
            />
          </div>
          
          {["TSU", "INMOB", "OBRAS"].includes(formData.category) && (
            <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.paidByTenant}
                  onChange={(e) => setFormData({ ...formData, paidByTenant: e.target.checked })}
                />
                <span className="text-sm font-medium text-gray-900">Pago por el inquilino</span>
              </label>
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              style={{ backgroundColor: '#1B5E20' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2E7D32'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1B5E20'}
            >
              <Plus className="h-4 w-4 mr-2" />
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}