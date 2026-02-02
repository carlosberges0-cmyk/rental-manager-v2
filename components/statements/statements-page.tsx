"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { format, parse, startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns"
import { aggregateByGroup, computeStatement } from "@/lib/services/statement-calculator"
import { upsertStatement, getStatements } from "@/lib/actions/statements"
import { getExpenses } from "@/lib/actions/expenses"
import { useRouter } from "next/navigation"
import { StatementRow } from "./statement-row"
import { Download, Plus } from "lucide-react"
import * as XLSX from "xlsx"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createExpense } from "@/lib/actions/expenses"

interface StatementsPageProps {
  initialStatements: any[]
  units: any[]
  propertyGroupsMap?: Map<string, string>
  rentalPeriods: any[]
  expenses: any[]
  initialPeriod: string
}

export function StatementsPage({
  initialStatements,
  units,
  propertyGroupsMap = new Map(),
  rentalPeriods,
  expenses,
  initialPeriod,
}: StatementsPageProps) {
  const [period, setPeriod] = useState(initialPeriod)
  const [selectedYear, setSelectedYear] = useState(() => parse(initialPeriod, "yyyy-MM", new Date()).getFullYear())
  const [statements, setStatements] = useState(initialStatements)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [annualData, setAnnualData] = useState<any[]>([])
  const [annualRows, setAnnualRows] = useState<any[]>([])
  const [loadingAnnual, setLoadingAnnual] = useState(false)
  const [annualRefreshKey, setAnnualRefreshKey] = useState(0) // Incrementar al guardar para recargar anual
  const [showExpenseDialog, setShowExpenseDialog] = useState(false)
  const [expenseFilterMonth, setExpenseFilterMonth] = useState(period) // Mes/año para filtrar gastos
  const [expenseDetails, setExpenseDetails] = useState<{
    open: boolean
    title: string
    expenses: any[]
    manualValue?: number
    currency?: string
  }>({ open: false, title: "", expenses: [] })
  const { addToast } = useToast()
  const router = useRouter()

  const unitsRef = useRef(units)
  unitsRef.current = units

  const getGroupName = (row: any) =>
    row.unit?.propertyGroup?.name || (row.unit?.propertyGroupId ? propertyGroupsMap.get(row.unit.propertyGroupId) : null) || "Sin Grupo"

  // Un solo período: gastos del mes = mismo mes que la liquidación
  useEffect(() => {
    setExpenseFilterMonth(period)
  }, [period])

  // Cargar datos anuales (statements + gastos del año)
  useEffect(() => {
    const loadAnnualData = async () => {
      const units = unitsRef.current

      setLoadingAnnual(true)
      try {
        const yearStart = startOfYear(new Date(selectedYear, 0, 1))
        const yearEnd = endOfYear(new Date(selectedYear, 11, 31))
        const months = eachMonthOfInterval({ start: yearStart, end: yearEnd })

        // Helper simple para convertir a número
        const toNum = (val: any): number => {
          if (val == null) return 0
          if (typeof val === 'number') return isNaN(val) ? 0 : val
          if (typeof val === 'string') {
            const n = parseFloat(val)
            return isNaN(n) ? 0 : n
          }
          if (typeof val === 'object' && val?.toNumber) {
            try { return val.toNumber() } catch { return 0 }
          }
          return 0
        }

        // 1. Cargar statements del año y gastos del año
        const [monthlyStatements, allExpenses] = await Promise.all([
          Promise.all(months.map((month) => getStatements(format(month, "yyyy-MM")))),
          getExpenses(),
        ])
        const flatStatements = (monthlyStatements || []).flat().filter(Boolean)

        const statementsByMonthAndUnit = new Map<string, any>()
        flatStatements.forEach((stmt: any) => {
          statementsByMonthAndUnit.set(`${stmt.period}-${stmt.unitId}`, stmt)
        })

        const yearExpensesList = (allExpenses || []).filter(
          (e: any) => e.month && String(e.month).startsWith(String(selectedYear) + "-")
        )
        const osseByUnit = new Map<string, number>()
        const inmobByUnit = new Map<string, number>()
        const tsuByUnit = new Map<string, number>()
        const obrasByUnit = new Map<string, number>()
        const otrosByUnit = new Map<string, number>()
        yearExpensesList.forEach((e: any) => {
          const uid = e.unitId
          const amt = toNum(e.amount)
          if (e.category === "OSSE") {
            osseByUnit.set(uid, (osseByUnit.get(uid) || 0) + amt)
          } else if (e.category === "INMOB") {
            inmobByUnit.set(uid, (inmobByUnit.get(uid) || 0) + amt)
          } else if (e.category === "TSU") {
            tsuByUnit.set(uid, (tsuByUnit.get(uid) || 0) + amt)
          } else if (e.category === "OBRAS") {
            obrasByUnit.set(uid, (obrasByUnit.get(uid) || 0) + amt)
          } else if (e.category === "OTROS") {
            otrosByUnit.set(uid, (otrosByUnit.get(uid) || 0) + amt)
          }
        })

        const osseFromStmt = new Map<string, number>()
        const inmobFromStmt = new Map<string, number>()
        const tsuFromStmt = new Map<string, number>()
        const obrasFromStmt = new Map<string, number>()
        const otrosFromStmt = new Map<string, number>()

        console.log(`[Annual] Statements: ${flatStatements.length}, gastos año: ${yearExpensesList.length}`)

        // 2. Resultados por unidad: gastos (OSSE, Inmob, TSU, Obras, Otros) desde suma de TODOS los meses de gastos; si no hay, se usan statements después
        const resultados = new Map<string, any>()
        units.filter((u: any) => !u.archived).forEach((unit: any) => {
          resultados.set(unit.id, {
            unitId: unit.id,
            unit,
            tenantId: null,
            tenant: null,
            alquiler: 0,
            osse: osseByUnit.get(unit.id) || 0,
            inmob: inmobByUnit.get(unit.id) || 0,
            tsu: tsuByUnit.get(unit.id) || 0,
            obras: obrasByUnit.get(unit.id) || 0,
            otrosTotal: otrosByUnit.get(unit.id) || 0,
            expensas: 0,
            ivaAlquiler: 0,
            totalMes: 0,
            neto: 0,
            gastos: 0,
            neteado: 0,
          })
        })

        // 3. Sumar desde statements (alquiler, expensas, IVA) y acumular OSSE/Inmob/TSU/Obras/Otros para uso si no hay gastos
        months.forEach((month) => {
          const monthKey = format(month, "yyyy-MM")
          units.filter((u: any) => !u.archived).forEach((unit: any) => {
            const result = resultados.get(unit.id)!
            const stmt = statementsByMonthAndUnit.get(`${monthKey}-${unit.id}`)
            if (!stmt) return

            result.alquiler += toNum(stmt.alquiler)
            result.expensas += toNum(stmt.expensas)
            result.ivaAlquiler += toNum(stmt.ivaAlquiler)
            const u = unit.id
            osseFromStmt.set(u, (osseFromStmt.get(u) || 0) + toNum(stmt.osse))
            inmobFromStmt.set(u, (inmobFromStmt.get(u) || 0) + toNum(stmt.inmob))
            tsuFromStmt.set(u, (tsuFromStmt.get(u) || 0) + toNum(stmt.tsu))
            obrasFromStmt.set(u, (obrasFromStmt.get(u) || 0) + toNum(stmt.obras))
            otrosFromStmt.set(u, (otrosFromStmt.get(u) || 0) + toNum(stmt.otrosTotal))
            if (stmt.tenantId && !result.tenantId) {
              result.tenantId = stmt.tenantId
              result.tenant = stmt.tenant
            }
          })
        })

        // Si no hay gastos para alguna categoría, usar suma de todos los meses desde statements
        resultados.forEach((r) => {
          const u = r.unitId
          if ((r.osse || 0) === 0) r.osse = osseFromStmt.get(u) || 0
          if ((r.inmob || 0) === 0) r.inmob = inmobFromStmt.get(u) || 0
          if ((r.tsu || 0) === 0) r.tsu = tsuFromStmt.get(u) || 0
          if ((r.obras || 0) === 0) r.obras = obrasFromStmt.get(u) || 0
          if ((r.otrosTotal || 0) === 0) r.otrosTotal = otrosFromStmt.get(u) || 0
        })

        // 4. Gastos para neteado = OSSE + TSU + OBRAS + otros (Inmob NO se deduce del neto)
        resultados.forEach((r) => {
          r.gastos = (r.osse || 0) + (r.tsu || 0) + (r.obras || 0) + (r.otrosTotal || 0)
        })

        // 5. Total anual, neto, neteado (TOTAL_MES = Alquiler+OSSE+Inmob+TSU+IVA, NETO = TOTAL_MES - Expensas, NETEADO = NETO - Gastos)
        resultados.forEach((r) => {
          r.totalMes = (r.alquiler || 0) + (r.osse || 0) + (r.inmob || 0) + (r.tsu || 0) + (r.ivaAlquiler || 0)
          r.neto = r.totalMes - (r.expensas || 0)
          r.neteado = r.neto - r.gastos
        })

        // 6. Unidades con datos: al menos un statement O solo gastos (Obras/Otros)
        const rowsArray = Array.from(resultados.values())
          .filter(r => r.unit && (r.alquiler > 0 || r.gastos > 0 || r.expensas > 0))
          .sort((a, b) => {
            const groupA = getGroupName(a) || "ZZZ"
            const groupB = getGroupName(b) || "ZZZ"
            if (groupA !== groupB) return groupA.localeCompare(groupB)
            return (a.unit?.name || "").localeCompare(b.unit?.name || "")
          })

        console.log(`[Annual] ✅ Resultado final: ${rowsArray.length} unidades`, rowsArray.map(r => ({
          unidad: r.unit?.name,
          alquiler: r.alquiler,
          expensas: r.expensas,
          gastos: r.gastos,
          neteado: r.neteado
        })))

        setAnnualRows(rowsArray)
        setAnnualData([]) // No usamos datos mensuales para el gráfico
      } catch (error) {
        console.error("Error loading annual data:", error)
        setAnnualRows([])
        setAnnualData([])
      } finally {
        setLoadingAnnual(false)
      }
    }

    loadAnnualData()
  }, [selectedYear, annualRefreshKey])

  // Mostrar TODAS las unidades no archivadas (permite cargar alquiler manual aunque no tengan período activo)
  const activeUnits = useMemo(() => {
    return units.filter((unit: any) => !unit.archived)
  }, [units])

  // Estado para gastos del período mensual actual
  const [periodExpenses, setPeriodExpenses] = useState<any[]>(() => {
    // Inicializar con gastos del período actual desde props
    return expenses.filter((e: any) => e.month === initialPeriod)
  })

  // Cargar gastos del período mensual actual cuando cambia el período, expenses iniciales o el filtro
  useEffect(() => {
    const loadPeriodExpenses = async () => {
      try {
        const allExpensesData = await getExpenses()
        const filtered = allExpensesData.filter((e: any) => e.month === expenseFilterMonth)
        setPeriodExpenses(filtered)
        console.log(`[Monthly] Gastos cargados para período ${expenseFilterMonth}:`, filtered.length, 'gastos')
      } catch (error) {
        console.error('[Monthly] Error cargando gastos del período:', error)
      }
    }
    loadPeriodExpenses()
  }, [expenseFilterMonth, expenses])

  // Crear filas para todas las unidades activas
  const rows = useMemo(() => {
    const rowsMap = new Map<string, any>()

    // Agregar statements existentes (solo de unidades que siguen existiendo y no están archivadas)
    statements.forEach(stmt => {
      const unit = units.find(u => u.id === stmt.unitId)
      if (!unit) return // Unidad eliminada/archivada: no mostrar en liquidación
      const aplicaIvaAlquiler = unit?.aplicaIvaAlquiler ?? false
      const ivaRate = unit?.ivaRatePercent ? unit.ivaRatePercent / 100 : 0.21
      
      // Ya no hay categoría EXPENSAS, las expensas vienen del campo expensas del statement o monthlyExpensesAmount
      const manualExpensas = stmt.expensas ? Number(stmt.expensas) : 0
      const finalExpensas = manualExpensas
      
      // Sumar gastos del período mensual para esta unidad (si no están guardados en el statement)
      const unitExpenses = periodExpenses.filter((e: any) => e.unitId === stmt.unitId)
      const osseFromExpenses = unitExpenses.filter((e: any) => e.category === 'OSSE').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      const inmobFromExpenses = unitExpenses.filter((e: any) => e.category === 'INMOB').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      const tsuFromExpenses = unitExpenses.filter((e: any) => e.category === 'TSU').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      const obrasFromExpenses = unitExpenses.filter((e: any) => e.category === 'OBRAS').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      const otrosFromExpenses = unitExpenses.filter((e: any) => e.category === 'OTROS').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      
      // Usar valores del statement si existen, sino usar gastos del período
      const osse = (stmt.osse && Number(stmt.osse) > 0) ? Number(stmt.osse) : (osseFromExpenses > 0 ? osseFromExpenses : undefined)
      const inmob = (stmt.inmob && Number(stmt.inmob) > 0) ? Number(stmt.inmob) : (inmobFromExpenses > 0 ? inmobFromExpenses : undefined)
      const tsu = (stmt.tsu && Number(stmt.tsu) > 0) ? Number(stmt.tsu) : (tsuFromExpenses > 0 ? tsuFromExpenses : undefined)
      // Para OBRAS y OTROS: priorizar gastos del período, si no hay gastos usar valor guardado
      const obras = obrasFromExpenses > 0 ? obrasFromExpenses : ((stmt.obras && Number(stmt.obras) > 0) ? Number(stmt.obras) : undefined)
      const otrosTotal = otrosFromExpenses > 0 ? otrosFromExpenses : ((stmt.otrosTotal && Number(stmt.otrosTotal) > 0) ? Number(stmt.otrosTotal) : undefined)
      
      const computed = computeStatement({
        alquiler: stmt.alquiler || 0,
        osse,
        inmob,
        tsu,
        obras,
        otrosTotal,
        iva: stmt.ivaAlquiler != null ? Number(stmt.ivaAlquiler) : undefined,
        expensas: finalExpensas > 0 ? finalExpensas : undefined,
        aplicaIvaAlquiler,
        ivaRate,
        items: stmt.items?.map((item: any) => ({
          type: item.type,
          label: item.label,
          amount: item.amount,
          isDeduction: item.isDeduction,
        })),
      })
      
      rowsMap.set(stmt.unitId, {
        ...stmt,
        unit,
        osse: osse || null,
        inmob: inmob || null,
        tsu: tsu || null,
        obras: obras || null,
        otrosTotal: otrosTotal || null,
        expensas: finalExpensas > 0 ? finalExpensas : stmt.expensas,
        ivaAlquiler: computed.ivaAlquiler,
        totalMes: computed.totalMes,
        neto: computed.neto,
        gastos: computed.gastos,
        neteado: computed.neteado,
        isNew: false,
      })
    })

    // Agregar unidades sin statement
    activeUnits.forEach(unit => {
      if (!rowsMap.has(unit.id)) {
        const activePeriod = rentalPeriods.find(rp => 
          rp.unitId === unit.id &&
          rp.status === "ACTIVE"
        )

        const alquiler = activePeriod ? (typeof activePeriod.priceAmount === 'number' ? activePeriod.priceAmount : Number(activePeriod.priceAmount) || 0) : 0
        
        // Expensas vienen del campo monthlyExpensesAmount de la unidad (ya no hay categoría EXPENSAS)
        const expensas = unit.monthlyExpensesAmount ? Number(unit.monthlyExpensesAmount) : null
        
        // Sumar gastos del período mensual para esta unidad
        const unitExpenses = periodExpenses.filter((e: any) => e.unitId === unit.id)
        const osse = unitExpenses.filter((e: any) => e.category === 'OSSE').reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || null
        const inmob = unitExpenses.filter((e: any) => e.category === 'INMOB').reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || null
        const tsu = unitExpenses.filter((e: any) => e.category === 'TSU').reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || null
        // Para OBRAS y OTROS: sumar todos los gastos del período (se acumulan)
        const obras = unitExpenses.filter((e: any) => e.category === 'OBRAS').reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || null
        const otrosTotal = unitExpenses.filter((e: any) => e.category === 'OTROS').reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || null
        
        // Calcular totales iniciales
        const aplicaIvaAlquiler = unit.aplicaIvaAlquiler ?? false
        const ivaRate = unit.ivaRatePercent ? unit.ivaRatePercent / 100 : 0.21
        
        const computed = computeStatement({
          alquiler,
          osse: osse && osse > 0 ? osse : undefined,
          inmob: inmob && inmob > 0 ? inmob : undefined,
          tsu: tsu && tsu > 0 ? tsu : undefined,
          obras: obras && obras > 0 ? obras : undefined,
          otrosTotal: otrosTotal && otrosTotal > 0 ? otrosTotal : undefined,
          iva: undefined,
          expensas: expensas || undefined,
          aplicaIvaAlquiler,
          ivaRate,
        })

        rowsMap.set(unit.id, {
          id: null,
          period,
          unitId: unit.id,
          unit: unit,
          tenantId: activePeriod?.tenantId || null,
          tenant: activePeriod?.tenant || null,
          alquiler,
          osse: osse && osse > 0 ? osse : null,
          inmob: inmob && inmob > 0 ? inmob : null,
          tsu: tsu && tsu > 0 ? tsu : null,
          obras: obras && obras > 0 ? obras : null,
          otrosTotal: otrosTotal && otrosTotal > 0 ? otrosTotal : null,
          expensas,
          ivaAlquiler: computed.ivaAlquiler,
          totalMes: computed.totalMes,
          neto: computed.neto,
          gastos: computed.gastos,
          neteado: computed.neteado,
          currency: activePeriod?.currency || "ARS",
          isNew: true,
        })
      }
    })

    // Ordenar por grupo y luego por nombre de unidad
    return Array.from(rowsMap.values()).sort((a, b) => {
      const groupA = getGroupName(a) || "ZZZ"
      const groupB = getGroupName(b) || "ZZZ"
      if (groupA !== groupB) {
        return groupA.localeCompare(groupB)
      }
      return (a.unit?.name || "").localeCompare(b.unit?.name || "")
    })
  }, [statements, activeUnits, rentalPeriods, period, periodExpenses])

  // Calcular subtotales por grupo
  const groupTotals = useMemo(() => {
    const rowsWithGroup = rows.map(row => ({
      ...row,
      groupId: row.unit?.propertyGroupId || null,
      groupName: getGroupName(row),
    }))

    return aggregateByGroup(rowsWithGroup)
  }, [rows])

  const annualGroupTotals = useMemo(() => {
    const rowsWithGroup = annualRows.map((row: any) => ({
      ...row,
      groupId: row.unit?.propertyGroupId ?? row.unit?.propertyGroup?.id ?? null,
      groupName: getGroupName(row),
    }))
    return aggregateByGroup(rowsWithGroup)
  }, [annualRows])

  const handleSaveRow = async (rowData: any) => {
    try {
      const unit = units.find(u => u.id === rowData.unitId)
      if (!unit) {
        throw new Error("Unidad no encontrada")
      }

      // Ya no hay categoría EXPENSAS, las expensas vienen del campo expensas del rowData
      const manualExpensas = rowData.expensas ? Number(rowData.expensas) : 0
      const finalExpensas = manualExpensas

      console.log(`[Save] Guardando statement para unidad ${rowData.unitId} (${units.find(u => u.id === rowData.unitId)?.name}), período ${period}:`, {
        alquiler: rowData.alquiler,
        finalExpensas,
      })

      // Helper para convertir valores a números o undefined
      const toNumberOrUndefined = (val: any): number | undefined => {
        if (val === null || val === undefined || val === '') return undefined
        const num = typeof val === 'string' ? parseFloat(val.trim()) : Number(val)
        return isNaN(num) ? undefined : num
      }

      // Para OBRAS y OTROS: NO guardar valores en el statement, siempre calcularlos desde los gastos del período
      // Esto evita duplicaciones y permite que los gastos se acumulen automáticamente
      // Solo guardamos valores manuales si el usuario los ingresó directamente (sin gastos del período)
      const unitExpenses = periodExpenses.filter((e: any) => e.unitId === rowData.unitId)
      const obrasFromExpenses = unitExpenses.filter((e: any) => e.category === 'OBRAS').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      const otrosFromExpenses = unitExpenses.filter((e: any) => e.category === 'OTROS').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

      // Si hay gastos del período, no guardar valores manuales (se calcularán desde los gastos)
      // Si no hay gastos del período pero hay valor manual, guardar el valor manual
      const obrasManual = toNumberOrUndefined(rowData.obras) || 0
      const otrosManual = toNumberOrUndefined(rowData.otrosTotal) || 0
      
      // Solo guardar si hay valor manual Y no hay gastos del período (para permitir valores manuales sin gastos)
      // Si hay gastos del período, siempre usar undefined para que se calcule desde los gastos
      const obrasToSave = obrasFromExpenses > 0 ? undefined : (obrasManual > 0 ? obrasManual : undefined)
      const otrosToSave = otrosFromExpenses > 0 ? undefined : (otrosManual > 0 ? otrosManual : undefined)

      const statementData = {
        period,
        unitId: rowData.unitId,
        tenantId: rowData.tenantId || undefined,
        alquiler: (rowData.alquiler !== null && rowData.alquiler !== undefined && rowData.alquiler !== '') 
          ? Number(rowData.alquiler) 
          : 0,
        osse: toNumberOrUndefined(rowData.osse),
        inmob: toNumberOrUndefined(rowData.inmob),
        tsu: toNumberOrUndefined(rowData.tsu),
        obras: obrasToSave,
        otrosTotal: otrosToSave,
        ivaAlquiler: toNumberOrUndefined(rowData.ivaAlquiler),
        expensas: finalExpensas > 0 ? finalExpensas : undefined,
        notes: rowData.notes || undefined,
      }

      console.log(`[Save] Datos del statement a guardar:`, statementData)

      const savedStatement = await upsertStatement(statementData)

      console.log(`[Save] Statement guardado exitosamente:`, {
        id: savedStatement?.id,
        unitId: savedStatement?.unitId,
        period: savedStatement?.period,
        alquiler: savedStatement?.alquiler,
        totalMes: savedStatement?.totalMes,
        neto: savedStatement?.neto,
        neteado: savedStatement?.neteado
      })

      addToast({
        title: "Liquidación guardada",
        description: "La liquidación se ha guardado correctamente",
      })

      // Recargar statements del período actual
      const updatedStatements = await getStatements(period)
      setStatements(updatedStatements)

      // Recargar resumen anual para que refleje los cambios de este mes
      setAnnualRefreshKey(k => k + 1)
      router.refresh()
      setEditingRow(null)
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo guardar la liquidación",
        variant: "destructive",
      })
    }
  }

  const handlePeriodChange = async (newPeriod: string) => {
    setPeriod(newPeriod)
    setExpenseFilterMonth(newPeriod) // Un solo período: mismo mes para liquidación y para gastos
    try {
      const newStatements = await getStatements(newPeriod)
      setStatements(newStatements)
      router.push(`/statements?period=${newPeriod}&year=${selectedYear}`)
      router.refresh()
    } catch (error) {
      console.error("Error loading statements for new period:", error)
    }
  }

  // Recargar datos cuando cambia el año seleccionado en la tabla anual
  useEffect(() => {
    const currentYear = parse(period, "yyyy-MM", new Date()).getFullYear()
    if (selectedYear !== currentYear) {
      // Solo recargar si el año es diferente al del período mensual
      router.push(`/statements?period=${period}&year=${selectedYear}`)
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear])

  // Exportar tabla mensual completa a Excel
  const exportMonthlyIVAIIBB = () => {
    try {
      const periodDate = parse(period, "yyyy-MM", new Date())
      
      const toNum = (val: any): number => {
        if (val == null) return 0
        if (typeof val === 'number') return isNaN(val) ? 0 : val
        if (typeof val === 'string') {
          const n = parseFloat(val)
          return isNaN(n) ? 0 : n
        }
        return 0
      }

      const data = rows.map((row: any) => ({
        "Propietario/Grupo": getGroupName(row),
        "Propietario": row.unit?.owner || "",
        "Unidad": row.unit?.name || "",
        "Alquiler": toNum(row.alquiler).toFixed(2),
        "OSSE": toNum(row.osse).toFixed(2),
        "Inmob": toNum(row.inmob).toFixed(2),
        "TSU": toNum(row.tsu).toFixed(2),
        "Obras": toNum(row.obras).toFixed(2),
        "Otros": toNum(row.otrosTotal).toFixed(2),
        "IVA": toNum(row.ivaAlquiler).toFixed(2),
        "Total del mes": toNum(row.totalMes).toFixed(2),
        "Expensas": toNum(row.expensas).toFixed(2),
        "Neto": toNum(row.neto).toFixed(2),
        "Gastos": toNum(row.gastos).toFixed(2),
        "Neteado": toNum(row.neteado).toFixed(2),
      }))

      // Agregar subtotales por grupo y total general
      // Primero agregar groupId y groupName a cada row
      const rowsWithGroup = rows.map(row => ({
        ...row,
        groupId: row.unit?.propertyGroupId || null,
        groupName: getGroupName(row),
      }))
      const exportGroupTotals = aggregateByGroup(rowsWithGroup)
      exportGroupTotals.forEach((groupTotal: any) => {
        if (groupTotal.groupId !== null) {
          data.push({
            "Propietario/Grupo": `Subtotal ${groupTotal.groupName}`,
            "Propietario": "",
            "Unidad": "",
            "Alquiler": groupTotal.alquiler.toFixed(2),
            "OSSE": groupTotal.osse.toFixed(2),
            "Inmob": groupTotal.inmob.toFixed(2),
            "TSU": groupTotal.tsu.toFixed(2),
            "Obras": groupTotal.obras.toFixed(2),
            "Otros": groupTotal.otrosTotal.toFixed(2),
            "IVA": groupTotal.ivaAlquiler.toFixed(2),
            "Total del mes": groupTotal.totalMes.toFixed(2),
            "Expensas": groupTotal.expensas.toFixed(2),
            "Neto": groupTotal.neto.toFixed(2),
            "Gastos": groupTotal.gastos.toFixed(2),
            "Neteado": groupTotal.neteado.toFixed(2),
          })
        }
      })

      // Agregar total general
      const totalGeneral = exportGroupTotals.find((gt: any) => gt.groupId === null)
      if (totalGeneral) {
        data.push({
          "Propietario/Grupo": "TOTAL GENERAL",
          "Propietario": "",
          "Unidad": "",
          "Alquiler": totalGeneral.alquiler.toFixed(2),
          "OSSE": totalGeneral.osse.toFixed(2),
          "Inmob": totalGeneral.inmob.toFixed(2),
          "TSU": totalGeneral.tsu.toFixed(2),
          "Obras": totalGeneral.obras.toFixed(2),
          "Otros": totalGeneral.otrosTotal.toFixed(2),
          "IVA": totalGeneral.ivaAlquiler.toFixed(2),
          "Total del mes": totalGeneral.totalMes.toFixed(2),
          "Expensas": totalGeneral.expensas.toFixed(2),
          "Neto": totalGeneral.neto.toFixed(2),
          "Gastos": totalGeneral.gastos.toFixed(2),
          "Neteado": totalGeneral.neteado.toFixed(2),
        })
      }

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `Liquidación ${format(periodDate, "MMMM yyyy")}`)
      XLSX.writeFile(wb, `liquidacion-mensual-${period}.xlsx`)

      addToast({
        title: "Exportación exitosa",
        description: `Se ha exportado la liquidación mensual de ${format(periodDate, "MMMM yyyy")}`,
      })
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo exportar el archivo",
        variant: "destructive",
      })
    }
  }

  // Exportar tabla anual completa a Excel
  const exportAnnualGanancias = () => {
    try {
      if (annualRows.length === 0) {
        addToast({
          title: "Sin datos",
          description: "No hay datos anuales para exportar",
          variant: "destructive",
        })
        return
      }

      const toNum = (val: any): number => {
        if (val == null) return 0
        if (typeof val === 'number') return isNaN(val) ? 0 : val
        if (typeof val === 'string') {
          const n = parseFloat(val)
          return isNaN(n) ? 0 : n
        }
        return 0
      }

      const data = annualRows.map((row: any) => ({
        "Propietario/Grupo": getGroupName(row),
        "Unidad": row.unit?.name || "",
        "Alquiler": toNum(row.alquiler).toFixed(2),
        "OSSE": toNum(row.osse).toFixed(2),
        "Inmob": toNum(row.inmob).toFixed(2),
        "TSU": toNum(row.tsu).toFixed(2),
        "Obras": toNum(row.obras).toFixed(2),
        "Otros": toNum(row.otrosTotal).toFixed(2),
        "IVA": toNum(row.ivaAlquiler).toFixed(2),
        "Total del año": toNum(row.totalMes).toFixed(2),
        "Expensas": toNum(row.expensas).toFixed(2),
        "Neto": toNum(row.neto).toFixed(2),
        "Gastos": toNum(row.gastos).toFixed(2),
        "Neteado": toNum(row.neteado).toFixed(2),
      }))

      const annualRowsWithGroup = annualRows.map((row: any) => ({
        ...row,
        groupId: row.unit?.propertyGroupId ?? row.unit?.propertyGroup?.id ?? null,
        groupName: getGroupName(row),
      }))
      const annualGroupTotals = aggregateByGroup(annualRowsWithGroup)

      annualGroupTotals.forEach((groupTotal: any) => {
        if (groupTotal.groupId !== null) {
          data.push({
            "Propietario/Grupo": `Subtotal ${groupTotal.groupName}`,
            "Unidad": "",
            "Alquiler": toNum(groupTotal.alquiler).toFixed(2),
            "OSSE": toNum(groupTotal.osse).toFixed(2),
            "Inmob": toNum(groupTotal.inmob).toFixed(2),
            "TSU": toNum(groupTotal.tsu).toFixed(2),
            "Obras": toNum(groupTotal.obras).toFixed(2),
            "Otros": toNum(groupTotal.otrosTotal).toFixed(2),
            "IVA": toNum(groupTotal.ivaAlquiler).toFixed(2),
            "Total del año": toNum(groupTotal.totalMes).toFixed(2),
            "Expensas": toNum(groupTotal.expensas).toFixed(2),
            "Neto": toNum(groupTotal.neto).toFixed(2),
            "Gastos": toNum(groupTotal.gastos).toFixed(2),
            "Neteado": toNum(groupTotal.neteado).toFixed(2),
          })
        }
      })

      const totalGeneral = annualGroupTotals.find((gt: any) => gt.groupId === null)
      if (totalGeneral) {
        data.push({
          "Propietario/Grupo": "TOTAL GENERAL",
          "Unidad": "",
          "Alquiler": toNum(totalGeneral.alquiler).toFixed(2),
          "OSSE": toNum(totalGeneral.osse).toFixed(2),
          "Inmob": toNum(totalGeneral.inmob).toFixed(2),
          "TSU": toNum(totalGeneral.tsu).toFixed(2),
          "Obras": toNum(totalGeneral.obras).toFixed(2),
          "Otros": toNum(totalGeneral.otrosTotal).toFixed(2),
          "IVA": toNum(totalGeneral.ivaAlquiler).toFixed(2),
          "Total del año": toNum(totalGeneral.totalMes).toFixed(2),
          "Expensas": toNum(totalGeneral.expensas).toFixed(2),
          "Neto": toNum(totalGeneral.neto).toFixed(2),
          "Gastos": toNum(totalGeneral.gastos).toFixed(2),
          "Neteado": toNum(totalGeneral.neteado).toFixed(2),
        })
      }

      const sheetName = `Anual ${selectedYear}`.slice(0, 31)
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
      XLSX.writeFile(wb, `liquidacion-anual-${selectedYear}.xlsx`)

      addToast({
        title: "Exportación exitosa",
        description: `Se ha exportado la liquidación anual para ${selectedYear}`,
      })
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo exportar el archivo",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto p-6 bg-white min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#F1F8F4] rounded-lg">
            <svg className="h-8 w-8 text-[#1B5E20]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[#1B5E20]">Liquidaciones</h1>
            <p className="text-gray-600 mt-1">Gestión de liquidaciones mensuales y anuales</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-3 bg-[#F1F8F4] px-4 py-2 rounded-lg border-2 border-[#d4e6dc]">
            <svg className="h-5 w-5 text-[#1B5E20]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <Label htmlFor="period" className="text-[#1B5E20] font-semibold">Período:</Label>
            <Input
              id="period"
              type="month"
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-40 border-2 border-[#d4e6dc] focus:border-[#1B5E20] focus:ring-[#1B5E20]"
            />
          </div>
          <Button
            onClick={exportMonthlyIVAIIBB}
            className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Mensual
          </Button>
          <Button
            onClick={exportAnnualGanancias}
            className="bg-[#4CAF50] hover:bg-[#388E3C] text-white"
            disabled={annualRows.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Anual
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="h-1 bg-gradient-to-r from-[#1B5E20] via-[#2E7D32] to-[#4CAF50] rounded-full"></div>
      </div>

      <Card className="border-2 border-[#d4e6dc] shadow-lg">
        <CardHeader className="bg-gradient-to-r from-[#F1F8F4] to-[#E8F5E9] border-b-2 border-[#4CAF50]">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold text-[#1B5E20] flex items-center gap-2">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Liquidación Mensual - {format(parse(period, "yyyy-MM", new Date()), "MMMM yyyy")}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                El <strong>Período</strong> de arriba define el mes que estás editando: liquidación y gastos son de ese mismo mes. Guardá cada mes para que sume en el resumen anual.
              </p>
            </div>
            <Button
              onClick={() => setShowExpenseDialog(true)}
              className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white ml-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Gasto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] text-white">
                  <th className="text-left p-4 font-bold sticky left-0 bg-[#1B5E20] z-10 border-r border-[#4CAF50]">Propietario/Grupo</th>
                  <th className="text-left p-4 font-bold">Unidad</th>
                  <th className="text-right p-4 font-bold">Alquiler</th>
                  <th className="text-right p-4 font-bold">OSSE</th>
                  <th className="text-right p-4 font-bold">Inmob</th>
                  <th className="text-right p-4 font-bold">TSU</th>
                  <th className="text-right p-4 font-bold">Obras</th>
                  <th className="text-right p-4 font-bold">Otros</th>
                  <th className="text-right p-4 font-bold">IVA</th>
                  <th className="text-right p-4 font-bold bg-[#4CAF50]">Total del mes</th>
                  <th className="text-right p-4 font-bold">Expensas</th>
                  <th className="text-right p-4 font-bold">Neto</th>
                  <th className="text-right p-4 font-bold bg-[#4CAF50]">Neteado</th>
                  <th className="text-center p-4 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const renderedRows: any[] = []

                  // Agrupar filas por grupo para mostrar subtotales
                  const rowsByGroup = new Map<string | null, typeof rows>()
                  rows.forEach(row => {
                    const groupId = row.unit?.propertyGroupId || null
                    if (!rowsByGroup.has(groupId)) {
                      rowsByGroup.set(groupId, [])
                    }
                    rowsByGroup.get(groupId)!.push(row)
                  })

                  // Renderizar filas con subtotales
                  rowsByGroup.forEach((groupRows, groupId) => {
                    // Renderizar filas del grupo
                    groupRows.forEach((row) => {
                      renderedRows.push(
                        <StatementRow
                          key={row.unitId || `new-${row.unitId}`}
                          row={row}
                          propertyGroupsMap={propertyGroupsMap}
                          isEditing={editingRow === row.unitId}
                          onEdit={() => setEditingRow(row.unitId)}
                          onCancel={() => setEditingRow(null)}
                          onSave={handleSaveRow}
                          units={units}
                          rentalPeriods={rentalPeriods}
                          periodExpenses={periodExpenses}
                          onShowExpenseDetails={(args) =>
                            setExpenseDetails({
                              open: true,
                              title: args.title,
                              expenses: args.expenses,
                              manualValue: args.manualValue,
                              currency: args.currency,
                            })
                          }
                          onAlquilerBlur={(r, val) => handleSaveRow({ ...r, alquiler: val })}
                        />
                      )
                    })

                    // Agregar subtotal del grupo (siempre mostrar subtotales, incluso para "Sin Grupo")
                    const groupTotal = groupTotals.find(gt => gt.groupId === groupId)
                    if (groupTotal && groupTotal.count > 0) {
                      renderedRows.push(
                        <tr key={`subtotal-${groupId || 'sin-grupo'}`} className="bg-[#E8F5E9] border-t-2 border-[#4CAF50] font-semibold">
                          <td colSpan={2} className="p-3 text-[#1B5E20]">
                            Subtotal {groupTotal.groupName} ({groupTotal.count} {groupTotal.count === 1 ? 'unidad' : 'unidades'})
                          </td>
                          <td className="p-3 text-right text-[#1B5E20]">{groupTotal.alquiler.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#1B5E20]">{groupTotal.osse.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#1B5E20]">{groupTotal.inmob.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#1B5E20]">{groupTotal.tsu.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#1B5E20]">{groupTotal.obras.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#1B5E20]">{groupTotal.otrosTotal.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#1B5E20]">{groupTotal.ivaAlquiler.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#1B5E20] font-bold">{groupTotal.totalMes.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#1B5E20]">{groupTotal.expensas.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#1B5E20]">{groupTotal.neto.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#1B5E20] font-bold">{groupTotal.neteado.toLocaleString()}</td>
                          <td></td>
                        </tr>
                      )
                    }
                  })

                  return renderedRows
                })()}
                
                {/* Subtotales por grupo (fallback si no se renderizaron arriba) */}
                {groupTotals.filter(gt => gt.groupId !== null && !rows.some(r => r.unit?.propertyGroupId === gt.groupId)).map((groupTotal, idx) => (
                  <tr key={`subtotal-${groupTotal.groupId}`} className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                    <td colSpan={2} className="p-3 text-gray-900">
                      Subtotal {groupTotal.groupName}
                    </td>
                    <td className="p-3 text-right text-gray-900">{groupTotal.alquiler.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-900">{groupTotal.osse.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-900">{groupTotal.inmob.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-900">{groupTotal.tsu.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-900">{groupTotal.obras.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-900">{groupTotal.otrosTotal.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-900">{groupTotal.ivaAlquiler.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-900">{groupTotal.totalMes.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-900">{groupTotal.expensas.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-900">{groupTotal.neto.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-900">{groupTotal.neteado.toLocaleString()}</td>
                    <td></td>
                  </tr>
                ))}

                {/* Total general */}
                {groupTotals.find(gt => gt.groupId === null) && (
                  <tr className="bg-[#1B5E20] text-white border-t-2 border-gray-400 font-bold">
                    <td colSpan={2} className="p-3">
                      TOTAL GENERAL
                      {(() => {
                        const total = groupTotals.find(gt => gt.groupId === null)!
                        return (
                          <span className="text-xs font-normal opacity-90 ml-2">
                            ({total.count} {total.count === 1 ? 'unidad' : 'unidades'})
                          </span>
                        )
                      })()}
                    </td>
                    {(() => {
                      const total = groupTotals.find(gt => gt.groupId === null)!
                      return (
                        <>
                          <td className="p-3 text-right">{total.alquiler.toLocaleString()}</td>
                          <td className="p-3 text-right">{total.osse.toLocaleString()}</td>
                          <td className="p-3 text-right">{total.inmob.toLocaleString()}</td>
                          <td className="p-3 text-right">{total.tsu.toLocaleString()}</td>
                          <td className="p-3 text-right">{total.obras.toLocaleString()}</td>
                          <td className="p-3 text-right">{total.otrosTotal.toLocaleString()}</td>
                          <td className="p-3 text-right">{total.ivaAlquiler.toLocaleString()}</td>
                          <td className="p-3 text-right font-bold text-lg">{total.totalMes.toLocaleString()}</td>
                          <td className="p-3 text-right">{total.expensas.toLocaleString()}</td>
                          <td className="p-3 text-right">{total.neto.toLocaleString()}</td>
                          <td className="p-3 text-right font-bold text-lg">{total.neteado.toLocaleString()}</td>
                          <td></td>
                        </>
                      )
                    })()}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Separador visual */}
      <div className="my-8">
        <div className="h-1 bg-gradient-to-r from-[#1B5E20] via-[#2E7D32] to-[#4CAF50] rounded-full"></div>
      </div>

      {/* Tabla Anual - Solo lectura, agregación automática de meses */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-[#1B5E20]">Resumen Anual</h2>
            <p className="text-gray-600 mt-1">Agregación automática de liquidaciones mensuales guardadas</p>
          </div>
          <div className="flex items-center gap-3 bg-[#F1F8F4] px-4 py-2 rounded-lg border-2 border-[#d4e6dc]">
            <svg className="h-5 w-5 text-[#1B5E20]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <Label htmlFor="year" className="text-[#1B5E20] font-semibold">Año:</Label>
            <Input
              id="year"
              type="number"
              min="2020"
              max="2100"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value) || selectedYear)}
              className="w-24 border-2 border-[#d4e6dc] focus:border-[#1B5E20] focus:ring-[#1B5E20] text-center font-semibold"
            />
          </div>
        </div>
      </div>

      {!loadingAnnual && (
        <Card className="border-2 border-[#d4e6dc] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#F1F8F4] to-[#E8F5E9] border-b-2 border-[#4CAF50]">
            <CardTitle className="text-2xl font-bold text-[#1B5E20] flex items-center gap-2">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Liquidación Anual - {selectedYear}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              Suma automática de <strong>solo los meses en que guardaste</strong> la liquidación (Guardar en cada mes).
              Si no guardaste enero pero sí febrero, el total anual será solo febrero (por eso puede ser menor que el total de un mes concreto).
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] text-white">
                    <th className="text-left p-4 font-bold sticky left-0 bg-[#1B5E20] z-10 border-r border-[#4CAF50]">Propietario/Grupo</th>
                    <th className="text-left p-4 font-bold">Unidad</th>
                    <th className="text-right p-4 font-bold">Alquiler</th>
                    <th className="text-right p-4 font-bold">OSSE</th>
                    <th className="text-right p-4 font-bold">Inmob</th>
                    <th className="text-right p-4 font-bold">TSU</th>
                    <th className="text-right p-4 font-bold">Obras</th>
                    <th className="text-right p-4 font-bold">Otros</th>
                    <th className="text-right p-4 font-bold">IVA</th>
                    <th className="text-right p-4 font-bold bg-[#4CAF50]">Total del año</th>
                    <th className="text-right p-4 font-bold">Expensas</th>
                    <th className="text-right p-4 font-bold">Neto</th>
                    <th className="text-right p-4 font-bold bg-[#4CAF50]">Neteado</th>
                  </tr>
                </thead>
                <tbody>
                  {annualRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="p-8 text-center text-gray-500 bg-[#F1F8F4]">
                        <div className="flex flex-col items-center gap-2">
                          <svg className="h-12 w-12 text-[#4CAF50] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-lg font-medium text-gray-700">No hay datos anuales disponibles</p>
                          <p className="text-sm text-gray-500">Los datos anuales se generan automáticamente al guardar liquidaciones mensuales</p>
                        </div>
                      </td>
                    </tr>
                  ) : (() => {
                    const renderedRows: any[] = []
                    const toNum = (v: any) => {
                      if (v == null) return 0
                      if (typeof v === "number") return isNaN(v) ? 0 : v
                      const n = parseFloat(String(v))
                      return isNaN(n) ? 0 : n
                    }

                    const rowsByGroup = new Map<string | null, any[]>()
                    annualRows.forEach((row: any) => {
                      const gid = row.unit?.propertyGroupId ?? row.unit?.propertyGroup?.id ?? null
                      if (!rowsByGroup.has(gid)) rowsByGroup.set(gid, [])
                      rowsByGroup.get(gid)!.push(row)
                    })

                    const groupOrder = Array.from(rowsByGroup.entries())
                      .map(([gid, rows]) => ({
                        groupId: gid,
                        groupName: (rows[0] ? getGroupName(rows[0]) : (gid === null ? "Total General" : "Sin Grupo")),
                      }))
                      .sort((a, b) => {
                        if (a.groupId === null) return 1
                        if (b.groupId === null) return -1
                        return (a.groupName || "").localeCompare(b.groupName || "")
                      })

                    groupOrder.forEach(({ groupId, groupName }) => {
                      const groupRows = rowsByGroup.get(groupId) || []
                      groupRows.forEach((row: any) => {
                        renderedRows.push(
                          <tr key={`annual-${row.unitId}`} className="border-b border-[#d4e6dc] hover:bg-[#F1F8F4]">
                            <td className="p-3 text-gray-700 sticky left-0 bg-white z-10 border-r border-[#d4e6dc]">
                              {getGroupName(row)}
                            </td>
                            <td className="p-3 text-gray-900 font-medium">{row.unit?.name || "-"}</td>
                            <td className="p-3 text-right text-gray-700">{toNum(row.alquiler).toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-700">{toNum(row.osse).toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-700">{toNum(row.inmob).toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-700">{toNum(row.tsu).toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-700">{toNum(row.obras).toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-700">{toNum(row.otrosTotal).toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-700">{toNum(row.ivaAlquiler).toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-900 font-bold">{toNum(row.totalMes).toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-700">{toNum(row.expensas).toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-700">{toNum(row.neto).toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-900 font-bold">{toNum(row.neteado).toLocaleString()}</td>
                          </tr>
                        )
                      })

                      if (groupId !== null) {
                        const gt = annualGroupTotals.find((g: any) => g.groupId === groupId)
                        if (gt && gt.count > 0) {
                          renderedRows.push(
                            <tr key={`annual-subtotal-${groupId}`} className="bg-[#E8F5E9] border-t-2 border-[#4CAF50] font-semibold">
                              <td colSpan={2} className="p-3 text-[#1B5E20]">
                                Subtotal {gt.groupName} ({gt.count} {gt.count === 1 ? "unidad" : "unidades"})
                              </td>
                              <td className="p-3 text-right text-[#1B5E20]">{toNum(gt.alquiler).toLocaleString()}</td>
                              <td className="p-3 text-right text-[#1B5E20]">{toNum(gt.osse).toLocaleString()}</td>
                              <td className="p-3 text-right text-[#1B5E20]">{toNum(gt.inmob).toLocaleString()}</td>
                              <td className="p-3 text-right text-[#1B5E20]">{toNum(gt.tsu).toLocaleString()}</td>
                              <td className="p-3 text-right text-[#1B5E20]">{toNum(gt.obras).toLocaleString()}</td>
                              <td className="p-3 text-right text-[#1B5E20]">{toNum(gt.otrosTotal).toLocaleString()}</td>
                              <td className="p-3 text-right text-[#1B5E20]">{toNum(gt.ivaAlquiler).toLocaleString()}</td>
                              <td className="p-3 text-right text-[#1B5E20] font-bold">{toNum(gt.totalMes).toLocaleString()}</td>
                              <td className="p-3 text-right text-[#1B5E20]">{toNum(gt.expensas).toLocaleString()}</td>
                              <td className="p-3 text-right text-[#1B5E20]">{toNum(gt.neto).toLocaleString()}</td>
                              <td className="p-3 text-right text-[#1B5E20] font-bold">{toNum(gt.neteado).toLocaleString()}</td>
                            </tr>
                          )
                        }
                      }
                    })

                    const totalGeneral = annualGroupTotals.find((g: any) => g.groupId === null)
                    if (totalGeneral) {
                      renderedRows.push(
                        <tr key="annual-total-general" className="bg-[#1B5E20] text-white border-t-2 border-gray-400 font-bold">
                          <td colSpan={2} className="p-3">
                            TOTAL GENERAL ANUAL
                            {totalGeneral.count > 0 && (
                              <span className="text-xs font-normal opacity-90 ml-2">
                                ({totalGeneral.count} {totalGeneral.count === 1 ? "unidad" : "unidades"})
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">{toNum(totalGeneral.alquiler).toLocaleString()}</td>
                          <td className="p-3 text-right">{toNum(totalGeneral.osse).toLocaleString()}</td>
                          <td className="p-3 text-right">{toNum(totalGeneral.inmob).toLocaleString()}</td>
                          <td className="p-3 text-right">{toNum(totalGeneral.tsu).toLocaleString()}</td>
                          <td className="p-3 text-right">{toNum(totalGeneral.obras).toLocaleString()}</td>
                          <td className="p-3 text-right">{toNum(totalGeneral.otrosTotal).toLocaleString()}</td>
                          <td className="p-3 text-right">{toNum(totalGeneral.ivaAlquiler).toLocaleString()}</td>
                          <td className="p-3 text-right font-bold text-lg">{toNum(totalGeneral.totalMes).toLocaleString()}</td>
                          <td className="p-3 text-right">{toNum(totalGeneral.expensas).toLocaleString()}</td>
                          <td className="p-3 text-right">{toNum(totalGeneral.neto).toLocaleString()}</td>
                          <td className="p-3 text-right font-bold text-lg">{toNum(totalGeneral.neteado).toLocaleString()}</td>
                        </tr>
                      )
                    }

                    return renderedRows.length > 0 ? renderedRows : (
                      <tr>
                        <td colSpan={13} className="p-8 text-center text-gray-500 bg-[#F1F8F4]">
                          <div className="flex flex-col items-center gap-2">
                            <svg className="h-12 w-12 text-[#4CAF50] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-lg font-medium text-gray-700">No hay datos anuales disponibles</p>
                            <p className="text-sm text-gray-500">Los datos anuales se generan automáticamente al guardar liquidaciones mensuales</p>
                          </div>
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {loadingAnnual && (
        <Card className="mt-6 border-2 border-[#d4e6dc] shadow-lg">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600">Cargando datos anuales...</p>
          </CardContent>
        </Card>
      )}

      {/* Diálogo para agregar gastos */}
      {showExpenseDialog && (
        <ExpenseDialog
          open={showExpenseDialog}
          onOpenChange={setShowExpenseDialog}
          units={units}
          defaultMonth={expenseFilterMonth}
          onSuccess={async (expense) => {
            setShowExpenseDialog(false)
            const allExpensesData = await getExpenses()
            const filtered = allExpensesData.filter((e: any) => e.month === expenseFilterMonth)
            setPeriodExpenses(filtered)
            setAnnualRefreshKey(k => k + 1) // Actualizar resumen anual
            router.refresh()
            addToast({
              title: "Gasto creado",
              description: "El gasto se ha agregado correctamente",
            })
          }}
        />
      )}

      {/* Diálogo para ver subgastos (fuera de la tabla para evitar <tr><div />) */}
      <Dialog
        open={expenseDetails.open}
        onOpenChange={(open) => setExpenseDetails((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{expenseDetails.title}</DialogTitle>
          </DialogHeader>

          {(() => {
            const total = expenseDetails.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
            const currency = expenseDetails.expenses[0]?.currency || expenseDetails.currency || "ARS"

            return (
              <div className="space-y-4">
                {expenseDetails.expenses.length === 0 ? (
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                    No hay subgastos registrados para mostrar.
                    {typeof expenseDetails.manualValue === "number" && expenseDetails.manualValue > 0 ? (
                      <div className="mt-2 font-medium">
                        Valor total mostrado en la tabla: {expenseDetails.manualValue.toLocaleString()} {currency}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {expenseDetails.expenses.map((expense) => (
                        <div
                          key={expense.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{expense.description || "Sin descripción"}</p>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                              <span>{format(new Date(expense.date), "dd/MM/yyyy")}</span>
                              {expense.vendor ? <span>• {expense.vendor}</span> : null}
                              <span>• {expense.currency}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {Number(expense.amount).toLocaleString()} {expense.currency}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-3 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg text-gray-900">Total:</span>
                        <span className="font-bold text-xl text-[#1B5E20]">
                          {total.toLocaleString()} {currency}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Componente de diálogo para agregar gastos
function ExpenseDialog({
  open,
  onOpenChange,
  units,
  defaultMonth,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  units: any[]
  defaultMonth?: string
  onSuccess: (data: any) => void
}) {
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()
  
  const baseDate = new Date()
  const calculateMonthFromDate = (dateStr: string) => {
    if (!dateStr) return defaultMonth || format(new Date(), "yyyy-MM")
    const date = new Date(dateStr)
    return format(date, "yyyy-MM")
  }
  
  type ExpenseCategory = "OSSE" | "INMOB" | "TSU" | "OBRAS" | "OTROS"
  const [formData, setFormData] = useState<{
    unitId: string
    month: string
    date: string
    category: ExpenseCategory
    description: string
    amount: string
    currency: "ARS" | "USD"
    deductibleFlag: boolean
    vendor: string
  }>({
    unitId: units[0]?.id || "",
    month: defaultMonth || format(new Date(), "yyyy-MM"),
    date: format(baseDate, "yyyy-MM-dd"),
    category: "OTROS",
    description: "",
    amount: "",
    currency: "ARS",
    deductibleFlag: false,
    vendor: "",
  })
  
  // Resetear formulario cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      setFormData({
        unitId: units[0]?.id || "",
        month: defaultMonth || format(new Date(), "yyyy-MM"),
        date: format(new Date(), "yyyy-MM-dd"),
        category: "OTROS",
        description: "",
        amount: "",
        currency: "ARS",
        deductibleFlag: false,
        vendor: "",
      })
    }
  }, [open, defaultMonth, units])
  
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

      const created = await createExpense(dataToSubmit)
      onSuccess(created)
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
          <DialogTitle className="text-gray-900">Nuevo Gasto</DialogTitle>
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
              El mes/año se calculará automáticamente desde la fecha seleccionada
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category" className="text-gray-900">Tipo de gasto *</Label>
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
                onChange={(e) => setFormData({ ...formData, currency: e.target.value as "ARS" | "USD" })}
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
            <Label htmlFor="amount" className="text-gray-900">Importe *</Label>
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
          
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.deductibleFlag}
                onChange={(e) => setFormData({ ...formData, deductibleFlag: e.target.checked })}
              />
              <span className="text-sm text-gray-900">Deducible</span>
            </label>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
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
