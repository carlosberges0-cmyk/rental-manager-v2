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
  iva?: number // IVA como monto editable (no calculado)
  expensas?: number
  aplicaIvaAlquiler?: boolean // Deprecated: IVA ahora es input directo
  ivaRate?: number // Deprecated: usado solo si iva no se proporciona (fallback)
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
 * Calcula los totales de una liquidación mensual (para TODAS las filas)
 *
 * Orden:
 * 1. TOTAL_DEL_MES = Alquiler + OSSE + INMOB + IVA (TSU no va al total del mes)
 * 2. NETO = Total del mes - Expensas (input)
 * 3. NETEADO = NETO - OSSE - TSU - INMOB - OBRAS - Otros
 */
export function computeStatement(input: StatementInput): ComputedTotals {
  const alquiler = Number(input.alquiler || 0)
  const osse = Number(input.osse || 0)
  const inmob = Number(input.inmob || 0)
  const tsu = Number(input.tsu || 0)
  const obras = Number(input.obras || 0)
  const otrosTotal = Number(input.otrosTotal || 0)
  const expensas = Number(input.expensas || 0)

  // IVA como monto editable; si no se pasa, fallback a alquiler * ivaRate (legacy)
  let ivaAlquiler = Number(input.iva ?? 0)
  if (ivaAlquiler === 0 && input.aplicaIvaAlquiler && (input.ivaRate ?? 0) > 0) {
    ivaAlquiler = alquiler * Number(input.ivaRate)
  }

  // 1. TOTAL_DEL_MES = Alquiler + OSSE + INMOB + IVA (TSU no se suma aquí)
  let totalMes = alquiler + osse + inmob + ivaAlquiler

  // Agregar items CHARGE
  if (input.items) {
    input.items.forEach(item => {
      if (item.type === "CHARGE") totalMes += Number(item.amount || 0)
    })
  }

  // Restar items DEDUCTION del totalMes
  if (input.items) {
    input.items.forEach(item => {
      if (item.type === "DEDUCTION" || item.isDeduction) {
        totalMes -= Number(item.amount || 0)
      }
    })
  }

  // 2. NETO = TOTAL_MES - EXPENSAS
  const neto = totalMes - expensas

  // 3. GASTOS = OSSE + TSU + INMOB + OBRAS + OTROS (se restan del neto para neteado)
  let gastos = osse + tsu + inmob + obras + otrosTotal
  if (input.items) {
    input.items.forEach(item => {
      if (item.type === "DEDUCTION" || item.isDeduction) {
        gastos += Number(item.amount || 0)
      }
    })
  }

  // 4. NETEADO = NETO - GASTOS
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
    if (input.iva != null && input.iva < 0) errors.push("IVA no puede ser negativo")
    if (input.expensas && input.expensas < 0) errors.push("Expensas no puede ser negativo")
  }

  const rate = input.ivaRate ?? 0
  if (rate < 0 || rate > 1) {
    errors.push("IVA rate debe estar entre 0 y 1 (ej: 0.21 para 21%)")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
