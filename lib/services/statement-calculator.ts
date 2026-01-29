/**
 * Servicio para cálculo de liquidación mensual
 * Implementa las reglas de cálculo según el Excel
 * 
 * NOTA: Este archivo NO debe importar Prisma/Decimal para poder usarse en componentes cliente
 */

export interface StatementInput {
  alquiler: number
  osse?: number
  inmob?: number
  tsu?: number
  obras?: number
  otrosTotal?: number
  expensas?: number
  aplicaIvaAlquiler: boolean
  ivaRate: number // Ej: 0.21 para 21%
  // Items adicionales (opcional)
  items?: Array<{
    type: "CHARGE" | "DEDUCTION" | "INFO"
    label: string
    amount: number
    isDeduction?: boolean
  }>
}

export interface ComputedTotals {
  ivaAlquiler: number
  totalMes: number
  neto: number
  gastos: number
  neteado: number
}

/**
 * Calcula los totales de una liquidación mensual
 * 
 * Reglas:
 * - TOTAL_MES = ALQUILER + IVA_ALQUILER - OSSE - INMOB - TSU - OBRAS - OTROS
 * - IVA_ALQUILER = ALQUILER * iva_rate (si aplica_iva_alquiler = true)
 * - NETO = TOTAL_MES - EXPENSAS
 * - GASTOS = INMOB + OSSE + TSU + OBRAS (+ OTROS si isDeduction = true)
 * - NETEADO = NETO - GASTOS
 */
export function computeStatement(input: StatementInput): ComputedTotals {
  // Usar números JavaScript normales (sin Decimal para compatibilidad cliente/servidor)
  const alquiler = Number(input.alquiler || 0)
  const osse = Number(input.osse || 0)
  const inmob = Number(input.inmob || 0)
  const tsu = Number(input.tsu || 0)
  const obras = Number(input.obras || 0)
  const otrosTotal = Number(input.otrosTotal || 0)
  const expensas = Number(input.expensas || 0)
  const ivaRate = Number(input.ivaRate || 0)

  // 1. Calcular IVA sobre alquiler
  let ivaAlquiler = 0
  if (input.aplicaIvaAlquiler && ivaRate > 0) {
    ivaAlquiler = alquiler * ivaRate
  }

  // 2. Calcular TOTAL_MES
  // TOTAL_MES = ALQUILER + IVA_ALQUILER - OSSE - INMOB - TSU - OBRAS - OTROS
  let totalMes = alquiler + ivaAlquiler - osse - inmob - tsu - obras - otrosTotal

  // Agregar items adicionales de tipo CHARGE (se suman)
  if (input.items) {
    input.items.forEach(item => {
      if (item.type === "CHARGE") {
        totalMes += Number(item.amount || 0)
      }
    })
  }

  // Restar items adicionales de tipo DEDUCTION del totalMes también
  if (input.items) {
    input.items.forEach(item => {
      if (item.type === "DEDUCTION" || item.isDeduction) {
        totalMes -= Number(item.amount || 0)
      }
    })
  }

  // 3. Calcular NETO
  // NETO = TOTAL_MES - EXPENSAS
  const neto = totalMes - expensas

  // 4. Calcular GASTOS
  // GASTOS = INMOB + OSSE + TSU + OBRAS
  let gastos = inmob + osse + tsu + obras

  // Agregar OTROS si está marcado como deducción (por ahora no, solo items)
  // Agregar items de tipo DEDUCTION o con isDeduction = true
  if (input.items) {
    input.items.forEach(item => {
      if (item.type === "DEDUCTION" || item.isDeduction) {
        gastos += Number(item.amount || 0)
      }
    })
  }

  // 5. Calcular NETEADO
  // NETEADO = NETO - GASTOS
  const neteado = neto - gastos

  // Redondear a 2 decimales
  return {
    ivaAlquiler: roundTo2Decimals(ivaAlquiler),
    totalMes: roundTo2Decimals(totalMes),
    neto: roundTo2Decimals(neto),
    gastos: roundTo2Decimals(gastos),
    neteado: roundTo2Decimals(neteado),
  }
}

/**
 * Agrega totales por grupo de propiedades
 */
export interface GroupTotals {
  groupId: string | null
  groupName: string
  alquiler: number
  osse: number
  inmob: number
  tsu: number
  obras: number
  otrosTotal: number
  ivaAlquiler: number
  totalMes: number
  expensas: number
  neto: number
  gastos: number
  neteado: number
  count: number // Cantidad de unidades en el grupo
}

export interface StatementWithGroup {
  unitId: string
  groupId: string | null
  groupName: string
  [key: string]: any
}

export function aggregateByGroup(
  statements: StatementWithGroup[]
): GroupTotals[] {
  const groupsMap = new Map<string | null, GroupTotals>()

  // Inicializar total general (groupId = null)
  groupsMap.set(null, {
    groupId: null,
    groupName: "Total General",
    alquiler: 0,
    osse: 0,
    inmob: 0,
    tsu: 0,
    obras: 0,
    otrosTotal: 0,
    ivaAlquiler: 0,
    totalMes: 0,
    expensas: 0,
    neto: 0,
    gastos: 0,
    neteado: 0,
    count: 0,
  })

  statements.forEach(statement => {
    const groupId = statement.groupId || null
    const groupName = statement.groupName || "Sin Grupo"

    if (!groupsMap.has(groupId)) {
      groupsMap.set(groupId, {
        groupId,
        groupName,
        alquiler: 0,
        osse: 0,
        inmob: 0,
        tsu: 0,
        obras: 0,
        otrosTotal: 0,
        ivaAlquiler: 0,
        totalMes: 0,
        expensas: 0,
        neto: 0,
        gastos: 0,
        neteado: 0,
        count: 0,
      })
    }

    const group = groupsMap.get(groupId)!
    const alquiler = Number(statement.alquiler || 0)
    const osse = Number(statement.osse || 0)
    const inmob = Number(statement.inmob || 0)
    const tsu = Number(statement.tsu || 0)
    const obras = Number(statement.obras || 0)
    const otrosTotal = Number(statement.otrosTotal || 0)
    const ivaAlquiler = Number(statement.ivaAlquiler || 0)
    const totalMes = Number(statement.totalMes || 0)
    const expensas = Number(statement.expensas || 0)
    const neto = Number(statement.neto || 0)
    const gastos = Number(statement.gastos || 0)
    const neteado = Number(statement.neteado || 0)

    // Agregar al grupo específico
    group.alquiler += alquiler
    group.osse += osse
    group.inmob += inmob
    group.tsu += tsu
    group.obras += obras
    group.otrosTotal += otrosTotal
    group.ivaAlquiler += ivaAlquiler
    group.totalMes += totalMes
    group.expensas += expensas
    group.neto += neto
    group.gastos += gastos
    group.neteado += neteado
    group.count += 1

    // También agregar al total general (solo si no es el total general mismo)
    if (groupId !== null) {
      const totalGeneral = groupsMap.get(null)!
      totalGeneral.alquiler += alquiler
      totalGeneral.osse += osse
      totalGeneral.inmob += inmob
      totalGeneral.tsu += tsu
      totalGeneral.obras += obras
      totalGeneral.otrosTotal += otrosTotal
      totalGeneral.ivaAlquiler += ivaAlquiler
      totalGeneral.totalMes += totalMes
      totalGeneral.expensas += expensas
      totalGeneral.neto += neto
      totalGeneral.gastos += gastos
      totalGeneral.neteado += neteado
      totalGeneral.count += 1
    }
  })

  // Redondear todos los valores a 2 decimales
  const groups = Array.from(groupsMap.values()).map(group => ({
    ...group,
    alquiler: roundTo2Decimals(group.alquiler),
    osse: roundTo2Decimals(group.osse),
    inmob: roundTo2Decimals(group.inmob),
    tsu: roundTo2Decimals(group.tsu),
    obras: roundTo2Decimals(group.obras),
    otrosTotal: roundTo2Decimals(group.otrosTotal),
    ivaAlquiler: roundTo2Decimals(group.ivaAlquiler),
    totalMes: roundTo2Decimals(group.totalMes),
    expensas: roundTo2Decimals(group.expensas),
    neto: roundTo2Decimals(group.neto),
    gastos: roundTo2Decimals(group.gastos),
    neteado: roundTo2Decimals(group.neteado),
  }))

  // Ordenar: primero grupos específicos, luego total general
  return groups.sort((a, b) => {
    if (a.groupId === null) return 1
    if (b.groupId === null) return -1
    return a.groupName.localeCompare(b.groupName)
  })
}

/**
 * Redondea un número a 2 decimales
 */
function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Valida que los valores no sean negativos (salvo que se permita)
 */
export function validateStatementInput(
  input: StatementInput,
  allowNegatives: boolean = false
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!allowNegatives) {
    if (input.alquiler < 0) errors.push("Alquiler no puede ser negativo")
    if (input.osse && input.osse < 0) errors.push("OSSE no puede ser negativo")
    if (input.inmob && input.inmob < 0) errors.push("Inmob no puede ser negativo")
    if (input.tsu && input.tsu < 0) errors.push("TSU no puede ser negativo")
    if (input.obras && input.obras < 0) errors.push("Obras no puede ser negativo")
    if (input.expensas && input.expensas < 0) errors.push("Expensas no puede ser negativo")
  }

  if (input.ivaRate < 0 || input.ivaRate > 1) {
    errors.push("IVA rate debe estar entre 0 y 1 (ej: 0.21 para 21%)")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
