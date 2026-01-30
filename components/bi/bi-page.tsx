"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { format, subMonths, eachMonthOfInterval, startOfYear, endOfYear } from "date-fns"

/** UI types only — no Prisma. priceAmount is number, not Decimal. */
type UnitForBI = {
  id: string
  name: string
  ivaRatePercent?: number | null
  igRatePercent?: number | null
  iibbRatePercent?: number | null
  monthlyExpensesAmount?: number | null
}

type RentalPeriodUI = {
  id: string
  unitId: string
  tenantId: string | null
  startDate: Date
  endDate: Date
  priceAmount: number
  currency: "ARS" | "USD"
  billingFrequency: "MONTHLY" | "WEEKLY" | "DAILY" | "ONE_TIME"
  status: string
  notes: string | null
  exemptFromIVA: boolean
  unit: UnitForBI | null
  tenant: { name: string } | null
}

type ExpenseForBI = {
  id: string
  unitId: string
  month: string
  category: string
  amount: number
  totalAmount: number
  currency: string
  deductibleFlag: boolean
  unit: UnitForBI | null
}

type TaxDataForBI = {
  income?: number
  expenses?: number
  ivaAmount?: number
  iibbAmount?: number
  igEstimate?: number
  deductibleExpenses?: number
  incomeByMonth?: Record<string, number>
  expensesByMonth?: Record<string, { total: number; deductible: number }>
}

interface BIPageProps {
  taxData: TaxDataForBI
  rentalPeriods: RentalPeriodUI[]
  expenses: ExpenseForBI[]
  units: UnitForBI[]
}

export function BIPage({ taxData: initialTaxData, rentalPeriods, expenses, units }: BIPageProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedCurrency, setSelectedCurrency] = useState<"ARS" | "USD">("ARS")

  // Calculate KPIs
  const currentYear = new Date().getFullYear()
  const taxData = initialTaxData || { income: 0, expenses: 0, ivaAmount: 0, iibbAmount: 0, igEstimate: 0, deductibleExpenses: 0, incomeByMonth: {}, expensesByMonth: {} }
  
  // Calculate YTD KPIs for selected year
  const ytdKPIs = useMemo(() => {
    const yearStart = new Date(selectedYear, 0, 1)
    const yearEnd = new Date(selectedYear, 11, 31)
    
    // Calculate YTD income from rental periods
    let ytdIncome = 0
    let ytdTaxes = 0
    
    rentalPeriods
      .filter(rp => rp.currency === selectedCurrency && rp.status !== "CANCELLED")
      .forEach(period => {
        const periodStart = new Date(period.startDate)
        const periodEnd = new Date(period.endDate)
        
        if (periodStart > yearEnd || periodEnd < yearStart) return
        
        const actualStart = new Date(Math.max(periodStart.getTime(), yearStart.getTime()))
        const actualEnd = new Date(Math.min(periodEnd.getTime(), yearEnd.getTime()))
        const totalDays = Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        
        const priceAmount = typeof period.priceAmount === "number" ? period.priceAmount : Number(period.priceAmount) || 0
        
        let monthlyAmount = 0
        if (period.billingFrequency === "MONTHLY") {
          monthlyAmount = priceAmount
        } else if (period.billingFrequency === "WEEKLY") {
          monthlyAmount = priceAmount * 4.33
        } else if (period.billingFrequency === "DAILY") {
          monthlyAmount = priceAmount * 30
        } else if (period.billingFrequency === "ONE_TIME") {
          const periodTotalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          monthlyAmount = periodTotalDays > 0 ? priceAmount / (periodTotalDays / 30) : 0
        }
        
        // Calculate income for the year
        let currentDate = new Date(actualStart)
        while (currentDate <= actualEnd) {
          const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`
          if (monthKey.startsWith(`${selectedYear}-`)) {
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
            const daysInThisMonth = Math.min(
              daysInMonth - currentDate.getDate() + 1,
              Math.ceil((actualEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
            )
            const proportion = totalDays > 0 ? daysInThisMonth / totalDays : 0
            ytdIncome += monthlyAmount * proportion
          }
          currentDate.setMonth(currentDate.getMonth() + 1)
          currentDate.setDate(1)
        }
        
        // Calculate taxes using unit's tax rates
        const unit = period.unit
        if (!period.exemptFromIVA && unit) {
          const ivaRate = unit.ivaRatePercent != null ? Number(unit.ivaRatePercent) / 100 : 0
          const igRate = unit.igRatePercent != null ? Number(unit.igRatePercent) / 100 : 0
          const iibbRate = unit.iibbRatePercent != null ? Number(unit.iibbRatePercent) / 100 : 0
          
          const monthlyTax = monthlyAmount * (ivaRate + igRate + iibbRate)
          
          // Distribute tax across months in the year
          let taxCurrentDate = new Date(actualStart)
          while (taxCurrentDate <= actualEnd) {
            const monthKey = `${taxCurrentDate.getFullYear()}-${String(taxCurrentDate.getMonth() + 1).padStart(2, "0")}`
            if (monthKey.startsWith(`${selectedYear}-`)) {
              const daysInMonth = new Date(taxCurrentDate.getFullYear(), taxCurrentDate.getMonth() + 1, 0).getDate()
              const daysInThisMonth = Math.min(
                daysInMonth - taxCurrentDate.getDate() + 1,
                Math.ceil((actualEnd.getTime() - taxCurrentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
              )
              const proportion = totalDays > 0 ? daysInThisMonth / totalDays : 0
              ytdTaxes += monthlyTax * proportion
            }
            taxCurrentDate.setMonth(taxCurrentDate.getMonth() + 1)
            taxCurrentDate.setDate(1)
          }
        }
      })
    
    // Calculate YTD expenses breakdown for selected year and currency
    const yearExpenses = expenses.filter(e => e.currency === selectedCurrency && e.month.startsWith(`${selectedYear}-`))
    
    let ytdManualExpenses = 0
    let ytdExpensas = 0
    let ytdDeductibleExpenses = 0
    
    yearExpenses.forEach(expense => {
      const amount = typeof expense.amount === 'number' ? expense.amount : Number(expense.amount) || 0
      // All manual expenses go to manualExpenses (no EXPENSAS category anymore)
      ytdManualExpenses += amount
      if (expense.deductibleFlag) {
        ytdDeductibleExpenses += amount
      }
    })
    
    // Calculate unit monthly expenses for selected year
    let ytdUnitMonthlyExpenses = 0
    units.forEach(unit => {
      const monthlyExpensesAmount = unit.monthlyExpensesAmount != null ? Number(unit.monthlyExpensesAmount) : 0
      if (monthlyExpensesAmount > 0) {
        ytdUnitMonthlyExpenses += monthlyExpensesAmount
      }
    })
    
    // Margen YTD = ingreso - gastos - expensas - impuestos + gastos deducibles
    // gastos = manualExpenses + unitMonthlyExpenses
    const ytdGastos = ytdManualExpenses + ytdUnitMonthlyExpenses
    const ytdMargin = ytdIncome - ytdGastos - ytdExpensas - ytdTaxes + ytdDeductibleExpenses
    const profitability = ytdIncome > 0 ? (ytdMargin / ytdIncome) * 100 : 0
    
    return {
      ytdIncome,
      ytdGastos,
      ytdExpensas,
      ytdManualExpenses,
      ytdUnitMonthlyExpenses,
      ytdTaxes,
      ytdDeductibleExpenses,
      ytdMargin,
      profitability,
    }
  }, [rentalPeriods, expenses, units, selectedYear, selectedCurrency])
  
  const { ytdIncome, ytdGastos, ytdExpensas, ytdMargin, profitability } = ytdKPIs

  // Calculate occupancy rate
  const totalDays = units.length * 365
  const occupiedDays = rentalPeriods
    .filter((rp) => rp.status === "ACTIVE" && rp.currency === selectedCurrency)
    .reduce((acc, rp) => {
      const start = new Date(rp.startDate)
      const end = new Date(rp.endDate)
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      return acc + days
    }, 0)
  const occupancyRate = totalDays > 0 ? (occupiedDays / totalDays) * 100 : 0

  // Prepare monthly income vs expenses chart
  const months = eachMonthOfInterval({
    start: startOfYear(new Date(selectedYear, 0, 1)),
    end: endOfYear(new Date(selectedYear, 11, 31)),
  })

  const monthlyData = months.map((month) => {
    const monthKey = format(month, "yyyy-MM")
    const income = (taxData.incomeByMonth && taxData.incomeByMonth[monthKey]) || 0
    const expenseData = (taxData.expensesByMonth && taxData.expensesByMonth[monthKey]) || { total: 0, deductible: 0 }
    return {
      month: format(month, "MMM"),
      Ingresos: income,
      Gastos: expenseData.total || 0,
    }
  })

  // Prepare expenses by category chart
  const expensesByCategory: Record<string, number> = {}
  expenses
    .filter((e) => e.currency === selectedCurrency)
    .forEach((expense) => {
      const amount = typeof expense.amount === 'number' 
        ? expense.amount 
        : Number(expense.amount) || 0
      expensesByCategory[expense.category] =
        Number(expensesByCategory[expense.category] || 0) + Number(amount)
    })

  const categoryData = Object.entries(expensesByCategory).map(([category, amount]) => ({
    category,
    amount,
  }))

  // Calculate metrics per unit for the selected year
  const unitMetrics = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1))
    const yearEnd = endOfYear(new Date(selectedYear, 11, 31))
    const metrics: Record<string, {
      unit: UnitForBI
      income: number
      expenses: number
      expensas: number
      manualExpenses: number
      unitMonthlyExpenses: number
      taxes: number
      deductibleExpenses: number
      margin: number
      profitability: number
      occupancyDays: number
      occupancyRate: number
      currency: string
    }> = {}

    // Initialize metrics for all units
    units.forEach(unit => {
      metrics[unit.id] = {
        unit,
        income: 0,
        expenses: 0,
        expensas: 0,
        manualExpenses: 0,
        unitMonthlyExpenses: 0,
        taxes: 0,
        deductibleExpenses: 0,
        margin: 0,
        profitability: 0,
        occupancyDays: 0,
        occupancyRate: 0,
        currency: selectedCurrency,
      }
    })

    // Calculate income from rental periods
    rentalPeriods
      .filter(rp => rp.currency === selectedCurrency && rp.status !== "CANCELLED")
      .forEach(period => {
        const periodStart = new Date(period.startDate)
        const periodEnd = new Date(period.endDate)
        
        // Check if period overlaps with selected year
        if (periodStart > yearEnd || periodEnd < yearStart) return

        const unitId = period.unitId
        if (!metrics[unitId]) return

        // Calculate occupied days
        const overlapStart = new Date(Math.max(periodStart.getTime(), yearStart.getTime()))
        const overlapEnd = new Date(Math.min(periodEnd.getTime(), yearEnd.getTime()))
        const days = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        metrics[unitId].occupancyDays += days

        // Calculate income for the year
        const actualStart = new Date(Math.max(periodStart.getTime(), yearStart.getTime()))
        const actualEnd = new Date(Math.min(periodEnd.getTime(), yearEnd.getTime()))
        const totalDays = Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

        const priceAmount = typeof period.priceAmount === "number" ? period.priceAmount : Number(period.priceAmount) || 0
        
        let monthlyAmount = 0
        if (period.billingFrequency === "MONTHLY") {
          monthlyAmount = priceAmount
        } else if (period.billingFrequency === "WEEKLY") {
          monthlyAmount = priceAmount * 4.33
        } else if (period.billingFrequency === "DAILY") {
          monthlyAmount = priceAmount * 30
        } else if (period.billingFrequency === "ONE_TIME") {
          const periodTotalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          monthlyAmount = periodTotalDays > 0 ? priceAmount / (periodTotalDays / 30) : 0
        }

        // Distribute income across months in the year
        let currentDate = new Date(actualStart)
        while (currentDate <= actualEnd) {
          const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`
          if (monthKey.startsWith(`${selectedYear}-`)) {
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
            const daysInThisMonth = Math.min(
              daysInMonth - currentDate.getDate() + 1,
              Math.ceil((actualEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
            )
            const proportion = totalDays > 0 ? daysInThisMonth / totalDays : 0
            metrics[unitId].income = Number(metrics[unitId].income) + Number(monthlyAmount * proportion)
          }
          currentDate.setMonth(currentDate.getMonth() + 1)
          currentDate.setDate(1)
        }

        // Calculate taxes on income using unit's tax rates
        const unit = period.unit
        if (!period.exemptFromIVA && unit) {
          const ivaRate = unit.ivaRatePercent != null ? Number(unit.ivaRatePercent) / 100 : 0
          const igRate = unit.igRatePercent != null ? Number(unit.igRatePercent) / 100 : 0
          const iibbRate = unit.iibbRatePercent != null ? Number(unit.iibbRatePercent) / 100 : 0

          // Apply taxes to the monthly income
          const monthlyTax = monthlyAmount * (ivaRate + igRate + iibbRate)
          let taxCurrentDate = new Date(actualStart)
          while (taxCurrentDate <= actualEnd) {
            const monthKey = `${taxCurrentDate.getFullYear()}-${String(taxCurrentDate.getMonth() + 1).padStart(2, "0")}`
            if (monthKey.startsWith(`${selectedYear}-`)) {
              const daysInMonth = new Date(taxCurrentDate.getFullYear(), taxCurrentDate.getMonth() + 1, 0).getDate()
              const daysInThisMonth = Math.min(
                daysInMonth - taxCurrentDate.getDate() + 1,
                Math.ceil((actualEnd.getTime() - taxCurrentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
              )
              const proportion = totalDays > 0 ? daysInThisMonth / totalDays : 0
              metrics[unitId].taxes = Number(metrics[unitId].taxes) + Number(monthlyTax * proportion)
            }
            taxCurrentDate.setMonth(taxCurrentDate.getMonth() + 1)
            taxCurrentDate.setDate(1)
          }
        }
      })

    // Calculate expenses (manual expenses and expensas category)
    // Also track deductible expenses separately
    expenses
      .filter(e => e.currency === selectedCurrency && e.month.startsWith(`${selectedYear}-`))
      .forEach(expense => {
        const unitId = expense.unitId
        if (!metrics[unitId]) return

        // Ensure baseAmount is a number
        const baseAmount = typeof expense.amount === 'number' 
          ? expense.amount 
          : Number(expense.amount) || 0
        
        // Track deductible expenses (these reduce taxable income/impuestos)
        if (expense.deductibleFlag) {
          metrics[unitId].deductibleExpenses = Number(metrics[unitId].deductibleExpenses) + Number(baseAmount)
        }
        
        // All manual expenses go to manualExpenses (no EXPENSAS category anymore)
        metrics[unitId].manualExpenses = Number(metrics[unitId].manualExpenses) + Number(baseAmount)
        metrics[unitId].expenses = Number(metrics[unitId].expenses) + Number(baseAmount)
      })

    // Add unit's monthly expenses to each unit's total expenses
    // For annual calculation, multiply by 12 months
    units.forEach(unit => {
      if (!metrics[unit.id]) return
      
      const monthlyExpensesAmount = unit.monthlyExpensesAmount != null ? Number(unit.monthlyExpensesAmount) : 0
      
      if (monthlyExpensesAmount > 0) {
        // For annual metrics, multiply monthly expenses by 12
        const annualUnitExpenses = monthlyExpensesAmount * 12
        // Store unit monthly expenses separately (without multiplying, for reference)
        metrics[unit.id].unitMonthlyExpenses = monthlyExpensesAmount
        // Add annual amount to total expenses (esto son expensas del edificio, van en expensas)
        metrics[unit.id].expensas = Number(metrics[unit.id].expensas) + Number(annualUnitExpenses)
        // También sumar a expenses (el total)
        metrics[unit.id].expenses = Number(metrics[unit.id].expenses) + Number(annualUnitExpenses)
      }
    })

    // Calculate final metrics - ensure all values are numbers
    Object.values(metrics).forEach(metric => {
      metric.income = Number(metric.income) || 0
      metric.expenses = Number(metric.expenses) || 0
      metric.expensas = Number(metric.expensas) || 0
      metric.manualExpenses = Number(metric.manualExpenses) || 0
      metric.unitMonthlyExpenses = Number(metric.unitMonthlyExpenses) || 0
      metric.taxes = Number(metric.taxes) || 0
      metric.deductibleExpenses = Number(metric.deductibleExpenses) || 0
      metric.occupancyDays = Number(metric.occupancyDays) || 0
      
      // Margen = Ingresos - Gastos - Expensas - Impuestos + Gastos deducibles
      // Gastos = manualExpenses (gastos manuales que NO son expensas)
      // Expensas = expensas (categoría EXPENSAS de gastos manuales) + unitMonthlyExpenses * 12
      // Impuestos = taxes
      // Gastos deducibles = deductibleExpenses (sumar porque reducen el impuesto)
      // 
      // IMPORTANTE: 
      // - metric.expenses = manualExpenses + expensas + unitMonthlyExpenses*12 (TOTAL)
      // - metric.expensas = expensas (de gastos manuales) + unitMonthlyExpenses*12
      // - metric.manualExpenses = manualExpenses (gastos manuales que NO son expensas)
      //
      // Para el margen: restar manualExpenses + expensas por separado (expenses es el total pero se muestra separado en la tabla)
      metric.margin = metric.income - metric.manualExpenses - metric.expensas - metric.taxes + metric.deductibleExpenses
      metric.profitability = metric.income > 0 ? (metric.margin / metric.income) * 100 : 0
      
      // Debug log para verificar cálculos
      if (metric.income > 0) {
        console.log(`[BI] ${metric.unit.name}:`, {
          income: metric.income,
          expenses_total: metric.expenses,
          manualExpenses: metric.manualExpenses,
          expensas: metric.expensas,
          unitMonthlyExpenses: metric.unitMonthlyExpenses,
          taxes: metric.taxes,
          deductibleExpenses: metric.deductibleExpenses,
          margin_calculated: metric.margin,
          margin_expected: metric.income - metric.manualExpenses - metric.expensas - metric.taxes + metric.deductibleExpenses,
          profitability: metric.profitability
        })
      }
      metric.occupancyRate = 365 > 0 ? (metric.occupancyDays / 365) * 100 : 0
    })

    // Filtrar métricas que tienen datos
    const finalMetrics = Object.values(metrics).filter(m => {
      const hasData = m.income > 0 || m.expenses > 0 || m.expensas > 0 || m.manualExpenses > 0
      if (hasData) {
        console.log(`[BI Final] ${m.unit.name} (${m.unit.id}):`, {
          income: m.income,
          manualExpenses: m.manualExpenses,
          expensas: m.expensas,
          expenses_total: m.expenses,
          margin: m.margin,
          margin_should_be: m.income - m.manualExpenses - m.expensas - m.taxes + m.deductibleExpenses
        })
      }
      return hasData
    })
    
    // Ordenar por nombre y luego por ingresos (puede haber múltiples unidades con el mismo nombre)
    return finalMetrics.sort((a, b) => {
      const nameCompare = (a.unit.name || "").localeCompare(b.unit.name || "")
      if (nameCompare !== 0) return nameCompare
      // Si tienen el mismo nombre, ordenar por ID para consistencia
      return a.unit.id.localeCompare(b.unit.id)
    })
  }, [units, rentalPeriods, expenses, selectedYear, selectedCurrency])

  // Prepare comparison chart data
  const comparisonChartData = unitMetrics.map(metric => ({
    name: metric.unit.name,
    Ingresos: metric.income,
    Gastos: metric.expenses,
    Margen: metric.margin,
    Rentabilidad: metric.profitability,
  }))

  return (
    <div className="container mx-auto p-6 bg-white min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Business Intelligence</h1>
          <p className="text-gray-600 mt-1">Análisis y métricas de tu negocio</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedYear.toString()}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
          <Select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value as "ARS" | "USD")}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="border border-gray-200">
          <CardHeader className="bg-[#F1F8F4] border-b border-[#d4e6dc]">
            <CardTitle className="text-sm font-medium text-[#1B5E20]">Ingresos YTD</CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="text-2xl font-bold text-green-600">
              {ytdIncome.toLocaleString()} {selectedCurrency}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardHeader className="bg-[#F1F8F4] border-b border-[#d4e6dc]">
            <CardTitle className="text-sm font-medium text-[#1B5E20]">Gastos YTD</CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="text-2xl font-bold text-gray-700">
              {(ytdKPIs.ytdManualExpenses + ytdKPIs.ytdUnitMonthlyExpenses + ytdKPIs.ytdExpensas).toLocaleString()} {selectedCurrency}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardHeader className="bg-[#F1F8F4] border-b border-[#d4e6dc]">
            <CardTitle className="text-sm font-medium text-[#1B5E20]">Margen YTD</CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <div className={`text-2xl font-bold ${ytdMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {ytdMargin.toLocaleString()} {selectedCurrency}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardHeader className="bg-[#F1F8F4] border-b border-[#d4e6dc]">
            <CardTitle className="text-sm font-medium text-[#1B5E20]">Rentabilidad</CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <div className={`text-2xl font-bold ${profitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitability.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardHeader className="bg-[#F1F8F4] border-b border-[#d4e6dc]">
            <CardTitle className="text-sm font-medium text-[#1B5E20]">Ocupación</CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="text-2xl font-bold" style={{ color: '#1B5E20' }}>
              {occupancyRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="border border-gray-200">
          <CardHeader className="bg-white border-b border-gray-200">
            <CardTitle className="text-gray-900">Ingresos vs Gastos (Últimos 12 meses)</CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Ingresos" stroke="#1B5E20" strokeWidth={2} />
                <Line type="monotone" dataKey="Gastos" stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader className="bg-white border-b border-gray-200">
            <CardTitle className="text-gray-900">Gastos por Categoría</CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="category" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="amount" fill="#1B5E20" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tax Summary */}
      <Card className="border border-gray-200 mb-6">
        <CardHeader className="bg-[#F1F8F4] border-b border-[#d4e6dc]">
          <CardTitle className="text-[#1B5E20]">Resumen de Impuestos</CardTitle>
          <CardDescription className="text-gray-700">
            Cálculos orientativos; validar con contador
          </CardDescription>
        </CardHeader>
        <CardContent className="bg-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600 mb-1">IVA</div>
              <div className="text-lg font-semibold text-gray-900">
                {(taxData.ivaAmount ?? 0).toLocaleString()} {selectedCurrency}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">IIBB</div>
              <div className="text-lg font-semibold text-gray-900">
                {(taxData.iibbAmount ?? 0).toLocaleString()} {selectedCurrency}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">IG (Estimación)</div>
              <div className="text-lg font-semibold text-gray-900">
                {(taxData.igEstimate ?? 0).toLocaleString()} {selectedCurrency}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Gastos Deducibles</div>
              <div className="text-lg font-semibold text-gray-900">
                {(taxData.deductibleExpenses ?? 0).toLocaleString()} {selectedCurrency}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unit-by-Unit Metrics */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Análisis por Unidad ({selectedYear})</h2>
        
        {/* Comparison Chart */}
        {comparisonChartData.length > 0 && (
          <Card className="border border-gray-200 mb-6">
            <CardHeader className="bg-white border-b border-gray-200">
              <CardTitle className="text-gray-900">Comparación de Unidades</CardTitle>
            </CardHeader>
            <CardContent className="bg-white">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={comparisonChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="#1B5E20" />
                  <Bar dataKey="Gastos" fill="#dc2626" />
                  <Bar dataKey="Margen" fill="#2E7D32" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Unit Metrics Table */}
        {unitMetrics.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F1F8F4] border-b-2 border-[#d4e6dc]">
                  <th className="text-left p-4 font-semibold text-[#1B5E20]">Unidad</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Ingresos</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Gastos</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Expensas</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Impuestos</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Margen</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Rentabilidad</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Ocupación</th>
                </tr>
              </thead>
              <tbody>
                {unitMetrics.map((metric, index) => (
                  <tr 
                    key={`${metric.unit.id}-${index}`} 
                    className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="p-4 font-medium text-gray-900">{metric.unit.name}</td>
                    <td className="p-4 text-right font-semibold text-green-600">
                      {metric.income.toLocaleString()} {selectedCurrency}
                    </td>
                    <td className="p-4 text-right text-gray-700">
                      {metric.manualExpenses.toLocaleString()} {selectedCurrency}
                    </td>
                    <td className="p-4 text-right text-gray-600">
                      {metric.expensas.toLocaleString()} {selectedCurrency}
                    </td>
                    <td className="p-4 text-right text-gray-600">
                      {metric.taxes.toLocaleString()} {selectedCurrency}
                    </td>
                    <td className={`p-4 text-right font-semibold ${metric.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metric.margin.toLocaleString()} {selectedCurrency}
                    </td>
                    <td className={`p-4 text-right font-semibold ${metric.profitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metric.profitability.toFixed(1)}%
                    </td>
                    <td className="p-4 text-right text-gray-700">
                      {metric.occupancyRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {unitMetrics.length === 0 && (
          <Card className="border border-gray-200">
            <CardContent className="p-8 text-center">
              <p className="text-gray-600">No hay datos disponibles para el año {selectedYear}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
