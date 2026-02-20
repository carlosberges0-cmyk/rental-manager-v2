"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { format, subMonths, eachMonthOfInterval, startOfYear, endOfYear } from "date-fns"
import { es } from "date-fns/locale"

import type { RentalPeriodUI, ExpenseUI, UnitUI, TaxDataUI } from "@/lib/ui-types"

type StatementClient = { period: string; unitId: string; alquiler: number; totalMes?: number; neto?: number | null; neteado?: number | null; expensas?: number | null; gastos?: number; currency?: string; unit?: { name?: string; propertyGroup?: { id: string; name: string } | null; metrosCuadrados?: number | null } | null }

interface BIPageProps {
  taxData: TaxDataUI
  statementsByYear?: Record<number, StatementClient[]>
  rentalPeriods: RentalPeriodUI[]
  expenses: ExpenseUI[]
  units: UnitUI[]
  propertyGroups?: { id: string; name: string }[]
}

export function BIPage({ taxData: initialTaxData, statementsByYear = {}, rentalPeriods, expenses, units, propertyGroups = [] }: BIPageProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = format(new Date(), "yyyy-MM")
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedCurrency, setSelectedCurrency] = useState<"ARS" | "USD">("ARS")
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonth)
  const [chartSortBy, setChartSortBy] = useState<"precioM2" | "margenM2" | "margenPct">("margenPct")
  const [chartSortOrder, setChartSortOrder] = useState<"desc" | "asc">("desc")
  const [tablePeriodMode, setTablePeriodMode] = useState<"annual" | "month">("annual")

  // Calculate KPIs
  const taxData = initialTaxData || { income: 0, expenses: 0, ivaAmount: 0, iibbAmount: 0, igEstimate: 0, deductibleExpenses: 0, incomeByMonth: {}, expensesByMonth: {} }
  
  // Ingresos = totalMes (alquiler+IVA+etc.) para coincidir con la columna Alquiler de Liquidaciones
  const incomeByMonthFromStatements = useMemo(() => {
    const stmts = statementsByYear[selectedYear] || []
    const byMonth: Record<string, number> = {}
    stmts.forEach((s: StatementClient) => {
      if (!s.period?.startsWith(`${selectedYear}-`)) return
      if (s.currency && s.currency !== selectedCurrency) return
      const ingreso = s.totalMes != null ? Number(s.totalMes) : (s.alquiler != null ? Number(s.alquiler) : 0)
      byMonth[s.period] = (byMonth[s.period] || 0) + ingreso
    })
    return byMonth
  }, [statementsByYear, selectedYear, selectedCurrency])

  const expensasByMonthFromStatements = useMemo(() => {
    const stmts = (statementsByYear[selectedYear] || []).filter(
      (s: StatementClient) => !s.currency || s.currency === selectedCurrency
    )
    const byMonth: Record<string, number> = {}
    stmts.forEach((s: StatementClient) => {
      if (!s.period?.startsWith(`${selectedYear}-`)) return
      const exp = s.expensas != null ? Number(s.expensas) : 0
      byMonth[s.period] = (byMonth[s.period] || 0) + exp
    })
    return byMonth
  }, [statementsByYear, selectedYear, selectedCurrency])

  // Calculate YTD KPIs for selected year
  const ytdKPIs = useMemo(() => {
    let ytdIncome = 0
    Object.values(incomeByMonthFromStatements).forEach((v) => { ytdIncome += v })
    const ytdTaxes = selectedYear === new Date().getFullYear() && initialTaxData
      ? (Number(initialTaxData.ivaAmount) || 0) + (Number(initialTaxData.iibbAmount) || 0) + (Number(initialTaxData.igEstimate) || 0)
      : 0
    
    // Expensas = gastos del edificio desde liquidaciones (statements)
    let ytdExpensas = 0
    const stmtsForYear = (statementsByYear[selectedYear] || []).filter(
      (s: StatementClient) => !s.currency || s.currency === selectedCurrency
    )
    let ytdGastosLiquidacion = 0
    stmtsForYear.forEach((s: StatementClient) => {
      if (!s.period?.startsWith(`${selectedYear}-`)) return
      const exp = s.expensas != null ? Number(s.expensas) : 0
      ytdExpensas += exp
      const gastosStmt = s.gastos != null ? Number(s.gastos) : 0
      ytdGastosLiquidacion += gastosStmt
    })

    // Calculate YTD expenses breakdown for selected year and currency
    const yearExpenses = expenses.filter(e => e.currency === selectedCurrency && e.month.startsWith(`${selectedYear}-`))
    
    let ytdManualExpenses = 0
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
    // gastos = manualExpenses + unitMonthlyExpenses + gastos liquidación (OSSE, Inmob, TSU, Obras, Otros)
    const ytdGastos = ytdManualExpenses + ytdUnitMonthlyExpenses + ytdGastosLiquidacion
    const ytdMargin = ytdIncome - ytdGastos - ytdExpensas - ytdTaxes + ytdDeductibleExpenses
    const profitability = ytdIncome > 0 ? (ytdMargin / ytdIncome) * 100 : 0
    
    return {
      ytdIncome,
      ytdGastos,
      ytdExpensas,
      ytdManualExpenses,
      ytdUnitMonthlyExpenses,
      ytdGastosLiquidacion,
      ytdTaxes,
      ytdDeductibleExpenses,
      ytdMargin,
      profitability,
    }
  }, [incomeByMonthFromStatements, initialTaxData, statementsByYear, expenses, units, selectedYear, selectedCurrency])
  
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
    const income = incomeByMonthFromStatements[monthKey] ?? (taxData.incomeByMonth?.[monthKey] ?? 0)
    const expenseFromList = expenses
      .filter((e) => e.currency === selectedCurrency && e.month === monthKey)
      .reduce((sum, e) => sum + (typeof e.amount === "number" ? e.amount : Number(e.amount) || 0), 0)
    const expensasFromStmts = expensasByMonthFromStatements[monthKey] ?? 0
    const expenseData = taxData.expensesByMonth?.[monthKey]
    const gastos = selectedYear === new Date().getFullYear() && expenseData
      ? expenseData.total
      : expenseFromList + expensasFromStmts
    return {
      month: format(month, "MMM"),
      Ingresos: income,
      Gastos: gastos,
    }
  })

  // Calculate metrics per unit for the selected year
  const unitMetricsResult = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1))
    const yearEnd = endOfYear(new Date(selectedYear, 11, 31))
    const metrics: Record<string, {
      unit: UnitUI
      income: number
      expenses: number
      expensas: number
      manualExpenses: number
      gastosLiquidacion: number
      unitMonthlyExpenses: number
      taxes: number
      deductibleExpenses: number
      margin: number
      profitability: number
      occupancyDays: number
      occupancyRate: number
      gananciaPorM2: number
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
        gastosLiquidacion: 0,
        unitMonthlyExpenses: 0,
        taxes: 0,
        deductibleExpenses: 0,
        margin: 0,
        profitability: 0,
        occupancyDays: 0,
        occupancyRate: 0,
        gananciaPorM2: 0,
        currency: selectedCurrency,
      }
    })

    // Ingresos = totalMes (igual que columna Alquiler en Liquidaciones)
    const stmts = (statementsByYear[selectedYear] || []).filter(
      (s: StatementClient) => !s.currency || s.currency === selectedCurrency
    )
    stmts.forEach((s: StatementClient) => {
      const unitId = s.unitId
      if (!metrics[unitId]) return
      const ingreso = s.totalMes != null ? Number(s.totalMes) : (s.alquiler != null ? Number(s.alquiler) : 0)
      metrics[unitId].income = Number(metrics[unitId].income) + ingreso
      const gastosStmt = s.gastos != null ? Number(s.gastos) : 0
      metrics[unitId].gastosLiquidacion = Number(metrics[unitId].gastosLiquidacion) + gastosStmt
    })

    // Occupancy days from rental periods (para tasa de ocupación)
    rentalPeriods
      .filter(rp => rp.currency === selectedCurrency && rp.status !== "CANCELLED")
      .forEach(period => {
        const periodStart = new Date(period.startDate)
        const periodEnd = new Date(period.endDate)
        if (periodStart > yearEnd || periodEnd < yearStart) return
        const unitId = period.unitId
        if (!metrics[unitId]) return
        const overlapStart = new Date(Math.max(periodStart.getTime(), yearStart.getTime()))
        const overlapEnd = new Date(Math.min(periodEnd.getTime(), yearEnd.getTime()))
        const days = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        metrics[unitId].occupancyDays += days
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

    // Expensas desde liquidaciones (statements) - gastos del edificio por unidad
    stmts.forEach((s: StatementClient) => {
      const unitId = s.unitId
      if (!metrics[unitId]) return
      const exp = s.expensas != null ? Number(s.expensas) : 0
      metrics[unitId].expensas = Number(metrics[unitId].expensas) + exp
      metrics[unitId].expenses = Number(metrics[unitId].expenses) + exp
    })

    // Fallback: unit's monthlyExpensesAmount para unidades sin statements en el año
    units.forEach(unit => {
      if (!metrics[unit.id]) return
      const monthlyExpensesAmount = unit.monthlyExpensesAmount != null ? Number(unit.monthlyExpensesAmount) : 0
      metrics[unit.id].unitMonthlyExpenses = monthlyExpensesAmount
      const hasStatementsForUnit = stmts.some((s: StatementClient) => s.unitId === unit.id)
      if (!hasStatementsForUnit && monthlyExpensesAmount > 0) {
        const annualUnitExpenses = monthlyExpensesAmount * 12
        metrics[unit.id].expensas = Number(metrics[unit.id].expensas) + annualUnitExpenses
        metrics[unit.id].expenses = Number(metrics[unit.id].expenses) + annualUnitExpenses
      }
    })

    // Calculate final metrics - ensure all values are numbers
    Object.values(metrics).forEach(metric => {
      metric.income = Number(metric.income) || 0
      metric.gastosLiquidacion = Number(metric.gastosLiquidacion) || 0
      metric.expenses = Number(metric.expenses) || 0
      metric.expensas = Number(metric.expensas) || 0
      metric.manualExpenses = Number(metric.manualExpenses) || 0
      metric.unitMonthlyExpenses = Number(metric.unitMonthlyExpenses) || 0
      metric.taxes = Number(metric.taxes) || 0
      metric.deductibleExpenses = Number(metric.deductibleExpenses) || 0
      metric.occupancyDays = Number(metric.occupancyDays) || 0
      // expenses total = manual + gastos liquidación (OSSE, Inmob, TSU, Obras, Otros) + expensas
      metric.expenses = metric.manualExpenses + metric.gastosLiquidacion + metric.expensas
      
      // Margen = Ingresos - Gastos - Expensas - Impuestos + Gastos deducibles
      // Gastos = manualExpenses + gastosLiquidacion (OSSE, Inmob, TSU, Obras, Otros)
      // Expensas = expensas (liquidación + unitMonthlyExpenses*12)
      metric.margin = metric.income - metric.manualExpenses - metric.gastosLiquidacion - metric.expensas - metric.taxes + metric.deductibleExpenses
      metric.profitability = metric.income > 0 ? (metric.margin / metric.income) * 100 : 0
      const m2 = metric.unit.metrosCuadrados != null ? Number(metric.unit.metrosCuadrados) : 0
      metric.gananciaPorM2 = m2 > 0 ? metric.margin / m2 : 0
      metric.occupancyRate = 365 > 0 ? (metric.occupancyDays / 365) * 100 : 0
    })

    // Filtrar métricas que tienen datos (para tablas y otros gráficos)
    const finalMetrics = Object.values(metrics).filter(m =>
      m.income > 0 || m.expenses > 0 || m.expensas > 0 || m.manualExpenses > 0
    )
    const allMetrics = Object.values(metrics)
    const sorter = (a: typeof allMetrics[0], b: typeof allMetrics[0]) => {
      const nameCompare = (a.unit.name || "").localeCompare(b.unit.name || "")
      if (nameCompare !== 0) return nameCompare
      return a.unit.id.localeCompare(b.unit.id)
    }
    return { filtered: finalMetrics.sort(sorter), all: allMetrics.sort(sorter) }
  }, [units, statementsByYear, rentalPeriods, expenses, selectedYear, selectedCurrency])

  const unitMetrics = unitMetricsResult.filtered
  const unitMetricsAll = unitMetricsResult.all

  // Prepare comparison chart data (por unidad)
  const comparisonChartData = unitMetrics.map(metric => ({
    name: metric.unit.name,
    Ingresos: metric.income,
    Gastos: metric.expenses,
    Margen: metric.margin,
    Rentabilidad: metric.profitability,
  }))

  // Métricas por grupo (incluye todos los grupos para que aparezcan Constitucion, etc.)
  const propertyGroupsMap = useMemo(() => new Map(propertyGroups.map(g => [g.id, g.name])), [propertyGroups])
  const groupMetrics = useMemo(() => {
    const byGroup: Record<string, { name: string; income: number; expenses: number; margin: number; unitCount: number }> = {}
    // Inicializar todos los grupos (para que aparezcan aunque tengan 0)
    propertyGroups.forEach(g => {
      byGroup[g.id] = { name: g.name, income: 0, expenses: 0, margin: 0, unitCount: 0 }
    })
    byGroup["__sin_grupo__"] = { name: "Sin Grupo", income: 0, expenses: 0, margin: 0, unitCount: 0 }
    // Sumar métricas de cada unidad
    unitMetrics.forEach(metric => {
      const gid = (metric.unit.propertyGroupId || metric.unit.propertyGroup?.id) ?? "__sin_grupo__"
      const groupName = metric.unit.propertyGroup?.name ?? propertyGroupsMap.get(metric.unit.propertyGroupId || "") ?? "Sin Grupo"
      if (!byGroup[gid]) byGroup[gid] = { name: groupName, income: 0, expenses: 0, margin: 0, unitCount: 0 }
      byGroup[gid].income += metric.income
      byGroup[gid].expenses += metric.expenses
      byGroup[gid].margin += metric.margin
      byGroup[gid].unitCount += 1
    })
    const result = Object.entries(byGroup).map(([id, data]) => ({ ...data, id }))
    result.sort((a, b) => (a.name === "Sin Grupo" ? 1 : 0) - (b.name === "Sin Grupo" ? 1 : 0) || a.name.localeCompare(b.name))
    return result
  }, [unitMetrics, propertyGroups, propertyGroupsMap])

  // Datos para gráfico de margen por grupo + Total General
  const marginByGroupChartData = useMemo(() => {
    const rows = groupMetrics.map(g => ({ name: g.name, Margen: g.margin }))
    rows.push({ name: "Total General", Margen: ytdMargin })
    return rows
  }, [groupMetrics, ytdMargin])

  // Ganancia/m² por unidad: todas las unidades (0 si no hay m² o datos en el año)
  const gananciaPorM2ChartData = useMemo(() => {
    return unitMetricsAll
      .map(m => ({ name: m.unit.name, "Ganancia/m²": Math.round(m.gananciaPorM2) }))
      .sort((a, b) => b["Ganancia/m²"] - a["Ganancia/m²"])
  }, [unitMetricsAll])

  // Evolución ganancia/m² por mes (por unidad con m2)
  const evolucionGananciaM2Data = useMemo(() => {
    const stmts = (statementsByYear[selectedYear] || []).filter(
      (s: StatementClient) => !s.currency || s.currency === selectedCurrency
    )
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(selectedYear, 0, 1)),
      end: endOfYear(new Date(selectedYear, 11, 31)),
    })
    const unitsWithM2 = units.filter(u => u.metrosCuadrados != null && Number(u.metrosCuadrados) > 0)
    if (unitsWithM2.length === 0) return []

    const byMonth: Record<string, Record<string, number | string>> = {}
    months.forEach(m => {
      const key = format(m, "yyyy-MM")
      byMonth[key] = { month: format(m, "MMM") }
      unitsWithM2.forEach(u => { byMonth[key][u.name] = 0 })
    })
    stmts.forEach((s: StatementClient) => {
      const m2 = s.unit?.metrosCuadrados != null ? Number(s.unit.metrosCuadrados) : 0
      if (m2 <= 0 || !s.period) return
      const neteado = s.neteado != null ? Number(s.neteado) : 0
      const unitName = s.unit?.name || units.find(u => u.id === s.unitId)?.name || ""
      if (!unitName || !byMonth[s.period]) return
      const prev = byMonth[s.period][unitName]
      byMonth[s.period][unitName] = (typeof prev === "number" ? prev : 0) + (neteado / m2)
    })
    return Object.values(byMonth)
  }, [statementsByYear, selectedYear, selectedCurrency, units])

  // Gráfico por filas (unidad): Precio/m² y Margen % para el período elegido, orden configurable
  const effectivePeriod = useMemo(() => {
    const periodYear = selectedPeriod ? parseInt(selectedPeriod.slice(0, 4), 10) : selectedYear
    if (periodYear !== selectedYear) return format(new Date(selectedYear, 0, 1), "yyyy-MM")
    return selectedPeriod
  }, [selectedPeriod, selectedYear])

  useEffect(() => {
    const periodYear = selectedPeriod ? parseInt(selectedPeriod.slice(0, 4), 10) : selectedYear
    if (periodYear !== selectedYear) setSelectedPeriod(format(new Date(selectedYear, 0, 1), "yyyy-MM"))
  }, [selectedYear])

  const rowChartDataByPeriod = useMemo(() => {
    const stmts = (statementsByYear[selectedYear] || []).filter(
      (s: StatementClient) => s.period === effectivePeriod && (!s.currency || s.currency === selectedCurrency)
    )
    const stmtByUnitId = new Map(stmts.map((s: StatementClient) => [s.unitId, s]))
    const rows: { name: string; "Precio/m²": number; "Margen/m²": number; "Margen %": number }[] = units.map(u => {
      const s = stmtByUnitId.get(u.id)
      const m2 = u.metrosCuadrados != null && Number(u.metrosCuadrados) > 0 ? Number(u.metrosCuadrados) : 0
      if (s && m2 > 0) {
        const totalMes = s.totalMes != null ? Number(s.totalMes) : (s.alquiler != null ? Number(s.alquiler) : 0)
        const neto = s.neto != null ? Number(s.neto) : (s.neteado != null ? Number(s.neteado) : 0)
        const precioM2 = totalMes / m2
        const margenM2 = neto / m2
        const margenPct = totalMes > 0 ? (neto / totalMes) * 100 : 0
        return {
          name: u.name || u.id,
          "Precio/m²": Math.round(precioM2),
          "Margen/m²": Math.round(margenM2),
          "Margen %": Math.round(margenPct * 10) / 10,
        }
      }
      return {
        name: u.name || u.id,
        "Precio/m²": 0,
        "Margen/m²": 0,
        "Margen %": 0,
      }
    })
    const sortKey = chartSortBy === "precioM2" ? "Precio/m²" : chartSortBy === "margenM2" ? "Margen/m²" : "Margen %"
    const sorted = [...rows].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey]
      return chartSortOrder === "desc" ? -diff : diff
    })
    return sorted
  }, [statementsByYear, selectedYear, selectedCurrency, effectivePeriod, units, chartSortBy, chartSortOrder])

  // Métricas para la tabla: anual o por mes según tablePeriodMode
  type UnitMetricRow = { unit: UnitUI; income: number; expenses: number; expensas: number; manualExpenses: number; gastosLiquidacion: number; unitMonthlyExpenses: number; taxes: number; deductibleExpenses: number; margin: number; profitability: number; occupancyDays: number; occupancyRate: number; gananciaPorM2: number; currency: string }
  const tableMetrics = useMemo((): UnitMetricRow[] => {
    if (tablePeriodMode === "annual") {
      return unitMetrics as UnitMetricRow[]
    }
    const period = effectivePeriod
    if (!period) return unitMetricsAll as UnitMetricRow[]
    const [y, m] = period.split("-").map(Number)
    const monthStart = new Date(y, m - 1, 1)
    const monthEnd = new Date(y, m, 0)
    const daysInMonth = monthEnd.getDate()
    const stmts = (statementsByYear[selectedYear] || []).filter(
      (s: StatementClient) => s.period === period && (!s.currency || s.currency === selectedCurrency)
    )
    const monthExpenses = expenses.filter(
      e => e.currency === selectedCurrency && e.month === period
    )
    const metrics: Record<string, UnitMetricRow> = {}
    units.forEach(unit => {
      metrics[unit.id] = {
        unit,
        income: 0,
        expenses: 0,
        expensas: 0,
        manualExpenses: 0,
        gastosLiquidacion: 0,
        unitMonthlyExpenses: unit.monthlyExpensesAmount != null ? Number(unit.monthlyExpensesAmount) : 0,
        taxes: 0,
        deductibleExpenses: 0,
        margin: 0,
        profitability: 0,
        occupancyDays: 0,
        occupancyRate: 0,
        gananciaPorM2: 0,
        currency: selectedCurrency,
      }
    })
    stmts.forEach((s: StatementClient) => {
      const unitId = s.unitId
      if (!metrics[unitId]) return
      const ingreso = s.totalMes != null ? Number(s.totalMes) : (s.alquiler != null ? Number(s.alquiler) : 0)
      const exp = s.expensas != null ? Number(s.expensas) : 0
      const gastosStmt = s.gastos != null ? Number(s.gastos) : 0
      metrics[unitId].income += ingreso
      metrics[unitId].expensas += exp
      metrics[unitId].gastosLiquidacion += gastosStmt
      metrics[unitId].expenses += exp + gastosStmt
    })
    monthExpenses.forEach(expense => {
      const unitId = expense.unitId
      if (!metrics[unitId]) return
      const amount = typeof expense.amount === "number" ? expense.amount : Number(expense.amount) || 0
      if (expense.deductibleFlag) metrics[unitId].deductibleExpenses += amount
      metrics[unitId].manualExpenses += amount
      metrics[unitId].expenses += amount
    })
    units.forEach(unit => {
      if (!metrics[unit.id]) return
      const hasStmt = stmts.some((s: StatementClient) => s.unitId === unit.id)
      const monthlyAmount = unit.monthlyExpensesAmount != null ? Number(unit.monthlyExpensesAmount) : 0
      if (!hasStmt && monthlyAmount > 0) {
        metrics[unit.id].expensas += monthlyAmount
        metrics[unit.id].expenses += monthlyAmount
      }
    })
    rentalPeriods
      .filter(rp => rp.currency === selectedCurrency && rp.status !== "CANCELLED")
      .forEach(periodRp => {
        const periodStart = new Date(periodRp.startDate)
        const periodEnd = new Date(periodRp.endDate)
        if (periodStart > monthEnd || periodEnd < monthStart) return
        const unitId = periodRp.unitId
        if (!metrics[unitId]) return
        const overlapStart = new Date(Math.max(periodStart.getTime(), monthStart.getTime()))
        const overlapEnd = new Date(Math.min(periodEnd.getTime(), monthEnd.getTime()))
        const days = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        metrics[unitId].occupancyDays += days
      })
    const result = Object.values(metrics).map(metric => {
      metric.income = Number(metric.income) || 0
      metric.gastosLiquidacion = Number(metric.gastosLiquidacion) || 0
      metric.expenses = Number(metric.expenses) || 0
      metric.expensas = Number(metric.expensas) || 0
      metric.manualExpenses = Number(metric.manualExpenses) || 0
      metric.unitMonthlyExpenses = Number(metric.unitMonthlyExpenses) || 0
      metric.taxes = 0
      metric.deductibleExpenses = Number(metric.deductibleExpenses) || 0
      metric.expenses = metric.manualExpenses + metric.gastosLiquidacion + metric.expensas
      metric.margin = metric.income - metric.manualExpenses - metric.gastosLiquidacion - metric.expensas - metric.taxes + metric.deductibleExpenses
      metric.profitability = metric.income > 0 ? (metric.margin / metric.income) * 100 : 0
      const m2 = metric.unit.metrosCuadrados != null ? Number(metric.unit.metrosCuadrados) : 0
      metric.gananciaPorM2 = m2 > 0 ? metric.margin / m2 : 0
      metric.occupancyRate = daysInMonth > 0 ? (metric.occupancyDays / daysInMonth) * 100 : 0
      return metric
    })
    const sorter = (a: UnitMetricRow, b: UnitMetricRow) => {
      const nameCompare = (a.unit.name || "").localeCompare(b.unit.name || "")
      if (nameCompare !== 0) return nameCompare
      return a.unit.id.localeCompare(b.unit.id)
    }
    return result.sort(sorter)
  }, [tablePeriodMode, effectivePeriod, unitMetrics, unitMetricsAll, units, statementsByYear, expenses, rentalPeriods, selectedYear, selectedCurrency])

  return (
    <div className="container mx-auto p-6 bg-white min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Business Intelligence</h1>
          <p className="text-gray-600 mt-1">Análisis y métricas de tu negocio</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="bi-year" className="text-sm font-medium text-gray-700">Año</Label>
            <select
              id="bi-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="flex h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="bi-currency" className="text-sm font-medium text-gray-700">Moneda</Label>
            <select
              id="bi-currency"
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as "ARS" | "USD")}
              className="flex h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
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
              {(ytdKPIs.ytdManualExpenses + ytdKPIs.ytdUnitMonthlyExpenses + (ytdKPIs.ytdGastosLiquidacion ?? 0) + ytdKPIs.ytdExpensas).toLocaleString()} {selectedCurrency}
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

      {/* Gráfico por período: Precio/m² y Margen % por unidad, orden configurable */}
      <Card className="border border-gray-200 mb-6">
        <CardHeader className="bg-white border-b border-gray-200">
          <CardTitle className="text-gray-900">Precio/m², Margen/m² y Margen % por Unidad (por período)</CardTitle>
          <CardDescription className="text-gray-600">
            Elegí el período y ordená por precio/m², margen/m² o margen %. Se muestran todas las unidades (en 0 si no hay m² o liquidación en ese mes).
          </CardDescription>
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="bi-period" className="text-sm font-medium">Período</Label>
              <Input
                id="bi-period"
                type="month"
                value={effectivePeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-40 h-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="bi-sort" className="text-sm font-medium">Ordenar por</Label>
              <select
                id="bi-sort"
                value={chartSortBy}
                onChange={(e) => setChartSortBy(e.target.value as "precioM2" | "margenM2" | "margenPct")}
                className="flex h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm w-36"
              >
                <option value="precioM2">Precio/m²</option>
                <option value="margenM2">Margen/m²</option>
                <option value="margenPct">Margen %</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="bi-order" className="text-sm font-medium">Orden</Label>
              <select
                id="bi-order"
                value={chartSortOrder}
                onChange={(e) => setChartSortOrder(e.target.value as "desc" | "asc")}
                className="flex h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm w-40"
              >
                <option value="desc">Mayor a menor</option>
                <option value="asc">Menor a mayor</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="bg-white pt-4">
          {rowChartDataByPeriod.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(300, rowChartDataByPeriod.length * 36)}>
              <BarChart data={rowChartDataByPeriod} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" />
                <YAxis type="category" dataKey="name" width={140} stroke="#6b7280" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number | undefined, name: string | undefined) => {
                    const label = name ?? ""
                    let text: string
                    if (label === "Precio/m²" || label === "Margen/m²") {
                      text = `${value != null ? value.toLocaleString() : 0} ${selectedCurrency}/m²`
                    } else {
                      text = `${value ?? 0}%`
                    }
                    return [text, label]
                  }}
                />
                <Legend />
                <Bar dataKey="Precio/m²" fill="#1B5E20" name="Precio/m²" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Margen/m²" fill="#2E7D32" name="Margen/m²" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Margen %" fill="#66BB6A" name="Margen %" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 py-8 text-center">
              No hay datos para {effectivePeriod}. Guardá la liquidación de ese mes en Liquidaciones.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Margen por Grupo */}
      {marginByGroupChartData.length > 0 && (
        <Card className="border border-gray-200 mb-6">
          <CardHeader className="bg-white border-b border-gray-200">
            <CardTitle className="text-gray-900">Margen por Grupo ({selectedYear})</CardTitle>
            <CardDescription className="text-gray-600">Margen por grupo de propiedades y total general</CardDescription>
          </CardHeader>
          <CardContent className="bg-white">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={marginByGroupChartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" />
                <YAxis type="category" dataKey="name" width={120} stroke="#6b7280" />
                <Tooltip formatter={(v: number | undefined) => [v != null ? v.toLocaleString() + " " + selectedCurrency : "0", "Margen"]} />
                <Bar dataKey="Margen" fill="#1B5E20" name="Margen" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Ganancia por m² - comparación entre unidades */}
      {gananciaPorM2ChartData.length > 0 && (
        <Card className="border border-gray-200 mb-6">
          <CardHeader className="bg-white border-b border-gray-200">
            <CardTitle className="text-gray-900">Ganancia por m² por Unidad ({selectedYear})</CardTitle>
            <CardDescription className="text-gray-600">Comparación: qué unidades generan más ganancia por metro cuadrado (ordenadas de mayor a menor)</CardDescription>
          </CardHeader>
          <CardContent className="bg-white">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={gananciaPorM2ChartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" />
                <YAxis type="category" dataKey="name" width={120} stroke="#6b7280" />
                <Tooltip formatter={(v: number | undefined) => [v != null ? v.toLocaleString() + " " + selectedCurrency + "/m²" : "0", "Ganancia/m²"]} />
                <Bar dataKey="Ganancia/m²" fill="#2E7D32" name="Ganancia/m²" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Evolución ganancia/m² en el tiempo */}
      {evolucionGananciaM2Data.length > 0 && (() => {
        const unitNames = Object.keys(evolucionGananciaM2Data[0] || {}).filter(k => k !== "month")
        if (unitNames.length === 0) return null
        const colors = ["#1B5E20", "#2E7D32", "#4CAF50", "#66BB6A", "#81C784"]
        return (
          <Card className="border border-gray-200 mb-6">
            <CardHeader className="bg-white border-b border-gray-200">
              <CardTitle className="text-gray-900">Evolución Ganancia/m² por Mes ({selectedYear})</CardTitle>
              <CardDescription className="text-gray-600">Cómo evoluciona la ganancia por m² de cada unidad a lo largo del año</CardDescription>
            </CardHeader>
            <CardContent className="bg-white">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={evolucionGananciaM2Data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" tickFormatter={(v) => v.toLocaleString()} />
                  <Tooltip formatter={(v: number | undefined) => [v != null ? Math.round(v).toLocaleString() + " " + selectedCurrency + "/m²" : "0", ""]} />
                  <Legend />
                  {unitNames.slice(0, 8).map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )
      })()}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="border border-gray-200">
          <CardHeader className="bg-white border-b border-gray-200">
            <CardTitle className="text-gray-900">Ingresos vs Gastos ({selectedYear})</CardTitle>
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
      </div>

      {/* Unit-by-Unit Metrics */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Análisis por Unidad (
            {tablePeriodMode === "annual" ? selectedYear + " anual" : format(new Date(effectivePeriod + "-01"), "LLLL yyyy", { locale: es })}
            )
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="table-period-mode" className="text-sm font-medium text-gray-700">Período tabla</Label>
            <select
              id="table-period-mode"
              value={tablePeriodMode}
              onChange={(e) => setTablePeriodMode(e.target.value as "annual" | "month")}
              className="flex h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm w-28"
            >
              <option value="annual">Anual</option>
              <option value="month">Por mes</option>
            </select>
            {tablePeriodMode === "month" && (
              <>
                <Label htmlFor="table-period-month" className="text-sm font-medium text-gray-700">Mes</Label>
                <Input
                  id="table-period-month"
                  type="month"
                  value={effectivePeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-40 h-10"
                />
              </>
            )}
          </div>
        </div>

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

        {/* Filtro de período para la tabla - visible encima de la tabla */}
        <div className="flex flex-wrap items-center gap-4 py-3 px-4 mb-3 rounded-lg border border-gray-200 bg-gray-50">
          <span className="text-sm font-medium text-gray-700">Filtrar tabla por período:</span>
          <select
            id="table-period-mode-2"
            value={tablePeriodMode}
            onChange={(e) => setTablePeriodMode(e.target.value as "annual" | "month")}
            className="flex h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm w-28"
          >
            <option value="annual">Anual</option>
            <option value="month">Por mes</option>
          </select>
          {tablePeriodMode === "month" && (
            <Input
              id="table-period-month-2"
              type="month"
              value={effectivePeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-40 h-10"
            />
          )}
          {tablePeriodMode === "annual" && (
            <span className="text-sm text-gray-500">{selectedYear} (todo el año)</span>
          )}
        </div>

        {/* Unit Metrics Table */}
        {tableMetrics.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F1F8F4] border-b-2 border-[#d4e6dc]">
                  <th className="text-left p-4 font-semibold text-[#1B5E20]">Unidad</th>
                  <th className="text-left p-4 font-semibold text-[#1B5E20]">Grupo</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Ingresos</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Gastos</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Expensas</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Impuestos</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Margen</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Ganancia/m²</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Rentabilidad</th>
                  <th className="text-right p-4 font-semibold text-[#1B5E20]">Ocupación</th>
                </tr>
              </thead>
              <tbody>
                {tableMetrics.map((metric, index) => (
                  <tr 
                    key={`${metric.unit.id}-${index}`} 
                    className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="p-4 font-medium text-gray-900">{metric.unit.name}</td>
                    <td className="p-4 text-gray-600">{metric.unit.propertyGroup?.name ?? propertyGroupsMap.get(metric.unit.propertyGroupId || "") ?? "Sin Grupo"}</td>
                    <td className="p-4 text-right font-semibold text-green-600">
                      {metric.income.toLocaleString()} {selectedCurrency}
                    </td>
                    <td className="p-4 text-right text-gray-700">
                      {(metric.manualExpenses + (metric.gastosLiquidacion ?? 0)).toLocaleString()} {selectedCurrency}
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
                    <td className="p-4 text-right text-gray-600">
                      {metric.unit.metrosCuadrados != null && Number(metric.unit.metrosCuadrados) > 0
                        ? metric.gananciaPorM2.toLocaleString(undefined, { maximumFractionDigits: 0 }) + " " + selectedCurrency + "/m²"
                        : "-"}
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

        {tableMetrics.length === 0 && (
          <Card className="border border-gray-200">
            <CardContent className="p-8 text-center">
              <p className="text-gray-600">
                {tablePeriodMode === "annual" ? `No hay datos disponibles para el año ${selectedYear}` : `No hay datos para ${effectivePeriod}`}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
