"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"
import { getDefaultUserId } from "./auth-helper"
import { computeStatement, validateStatementInput } from "@/lib/services/statement-calculator"

const statementSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  unitId: z.string(),
  tenantId: z.string().optional(),
  alquiler: z.number().or(z.string()),
  osse: z.number().or(z.string()).optional(),
  inmob: z.number().or(z.string()).optional(),
  tsu: z.number().or(z.string()).optional(),
  obras: z.number().or(z.string()).optional(),
  otrosTotal: z.number().or(z.string()).optional(),
  expensas: z.number().or(z.string()).optional(),
  notes: z.string().optional(),
})

const statementItemSchema = z.object({
  type: z.enum(["CHARGE", "DEDUCTION", "INFO"]),
  label: z.string(),
  amount: z.number().or(z.string()),
  isDeduction: z.boolean().optional(),
})

/**
 * Helper para convertir Decimal a number
 */
function decimalToNumber(value: any): number | null {
  if (value === null || value === undefined) return null
  
  // Si es un Decimal de Prisma
  if (value instanceof Decimal) {
    try {
      return value.toNumber()
    } catch (e) {
      console.warn('[decimalToNumber] Error converting Decimal to number:', e, value)
      return null
    }
  }
  
  // Si es un objeto con método toNumber (otra implementación de Decimal)
  if (typeof value === "object" && value !== null && typeof value.toNumber === "function") {
    try {
      return value.toNumber()
    } catch (e) {
      console.warn('[decimalToNumber] Error converting object with toNumber to number:', e, value)
      return null
    }
  }
  
  // Si ya es un número
  if (typeof value === "number") {
    return isNaN(value) ? null : value
  }
  
  // Si es un string, intentar parsearlo
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed === "" || trimmed === "null" || trimmed === "undefined") return null
    const parsed = parseFloat(trimmed)
    return isNaN(parsed) ? null : parsed
  }
  
  return null
}

/**
 * Verifica que los modelos necesarios existan en Prisma Client
 */
function checkModelsAvailable() {
  if (!(prisma as any).monthlyStatement) {
    throw new Error(
      'MonthlyStatement model not available. Please run:\n' +
      '1. npm run db:generate (or npx prisma generate)\n' +
      '2. Restart the development server\n\n' +
      'Note: The migration already exists, you just need to regenerate the Prisma Client.'
    )
  }
}

/**
 * Crea o actualiza una liquidación mensual
 */
export async function upsertStatement(
  data: z.infer<typeof statementSchema>,
  items?: z.infer<typeof statementItemSchema>[]
) {
  checkModelsAvailable()
  const userId = await getDefaultUserId()

  // Verificar que la unidad existe y pertenece al usuario
  const unit = await prisma.unit.findFirst({
    where: {
      id: data.unitId,
      userId,
    },
    include: {
      propertyGroup: true,
    },
  })

  if (!unit) {
    throw new Error("Unidad no encontrada")
  }

  // Obtener configuración de la unidad para cálculos
  const aplicaIvaAlquiler = unit.aplicaIvaAlquiler ?? false
  const ivaRate = unit.ivaRatePercent
    ? decimalToNumber(unit.ivaRatePercent)! / 100
    : 0.21 // Default 21%

  // Preparar inputs
  // Asegurarse de que alquiler siempre sea un número válido (puede ser 0)
  const alquiler = (data.alquiler !== null && data.alquiler !== undefined)
    ? (typeof data.alquiler === "string" ? parseFloat(data.alquiler) : Number(data.alquiler))
    : 0
  // Si es NaN, usar 0
  const alquilerFinal = isNaN(alquiler) ? 0 : alquiler
  const osse = data.osse ? (typeof data.osse === "string" ? parseFloat(data.osse) : data.osse) : undefined
  const inmob = data.inmob ? (typeof data.inmob === "string" ? parseFloat(data.inmob) : data.inmob) : undefined
  const tsu = data.tsu ? (typeof data.tsu === "string" ? parseFloat(data.tsu) : data.tsu) : undefined
  const obras = data.obras ? (typeof data.obras === "string" ? parseFloat(data.obras) : data.obras) : undefined
  const otrosTotal = data.otrosTotal
    ? typeof data.otrosTotal === "string"
      ? parseFloat(data.otrosTotal)
      : data.otrosTotal
    : undefined
  const expensas = data.expensas
    ? typeof data.expensas === "string"
      ? parseFloat(data.expensas)
      : data.expensas
    : undefined

  // Validar inputs
  const validation = validateStatementInput(
    {
      alquiler,
      osse,
      inmob,
      tsu,
      obras,
      otrosTotal,
      expensas,
      aplicaIvaAlquiler,
      ivaRate,
      items: items?.map(item => ({
        type: item.type,
        label: item.label,
        amount: typeof item.amount === "string" ? parseFloat(item.amount) : item.amount,
        isDeduction: item.isDeduction,
      })),
    },
    false // No permitir negativos por defecto
  )

  if (!validation.valid) {
    throw new Error(`Errores de validación: ${validation.errors.join(", ")}`)
  }

  // Calcular totales
  const computed = computeStatement({
    alquiler: alquilerFinal,
    osse,
    inmob,
    tsu,
    obras,
    otrosTotal,
    expensas,
    aplicaIvaAlquiler,
    ivaRate,
    items: items?.map(item => ({
      type: item.type,
      label: item.label,
      amount: typeof item.amount === "string" ? parseFloat(item.amount) : item.amount,
      isDeduction: item.isDeduction,
    })),
  })

  // Buscar statement existente
  const existing = await (prisma as any).monthlyStatement.findUnique({
    where: {
      unitId_period: {
        unitId: data.unitId,
        period: data.period,
      },
    },
    include: {
      items: true,
    },
  })

  // Determinar currency (usar del rental period activo o default ARS)
  const activePeriod = await prisma.rentalPeriod.findFirst({
    where: {
      unitId: data.unitId,
      status: "ACTIVE",
      startDate: { lte: new Date(`${data.period}-01`) },
      endDate: { gte: new Date(`${data.period}-01`) },
    },
  })

  const currency = activePeriod?.currency || "ARS"

  if (existing) {
    // Actualizar
    const statement = await (prisma as any).monthlyStatement.update({
      where: { id: existing.id },
      data: {
        tenantId: data.tenantId || null,
        alquiler: new Decimal(alquilerFinal),
        osse: osse !== undefined ? new Decimal(osse) : null,
        inmob: inmob !== undefined ? new Decimal(inmob) : null,
        tsu: tsu !== undefined ? new Decimal(tsu) : null,
        obras: obras !== undefined ? new Decimal(obras) : null,
        otrosTotal: otrosTotal !== undefined ? new Decimal(otrosTotal) : null,
        expensas: expensas !== undefined ? new Decimal(expensas) : null,
        ivaAlquiler: new Decimal(computed.ivaAlquiler),
        totalMes: new Decimal(computed.totalMes),
        neto: new Decimal(computed.neto),
        gastos: new Decimal(computed.gastos),
        neteado: new Decimal(computed.neteado),
        currency,
        notes: data.notes || null,
      },
      include: {
        unit: {
          include: {
            propertyGroup: true,
          },
        },
        tenant: true,
        items: true,
      },
    })

      // Actualizar items
      if (items && items.length > 0) {
        // Eliminar items existentes
        await (prisma as any).statementItem.deleteMany({
          where: { statementId: statement.id },
        })

        // Crear nuevos items
        await (prisma as any).statementItem.createMany({
        data: items.map(item => ({
          statementId: statement.id,
          type: item.type,
          label: item.label,
          amount: new Decimal(typeof item.amount === "string" ? parseFloat(item.amount) : item.amount),
          currency,
          isDeduction: item.isDeduction || false,
        })),
      })
    }

    revalidatePath("/statements")
    return convertStatementToClient(statement)
  } else {
    // Crear nuevo
    const statement = await (prisma as any).monthlyStatement.create({
      data: {
        period: data.period,
        unitId: data.unitId,
        tenantId: data.tenantId || null,
        alquiler: new Decimal(alquilerFinal),
        osse: osse !== undefined ? new Decimal(osse) : null,
        inmob: inmob !== undefined ? new Decimal(inmob) : null,
        tsu: tsu !== undefined ? new Decimal(tsu) : null,
        obras: obras !== undefined ? new Decimal(obras) : null,
        otrosTotal: otrosTotal !== undefined ? new Decimal(otrosTotal) : null,
        expensas: expensas !== undefined ? new Decimal(expensas) : null,
        ivaAlquiler: new Decimal(computed.ivaAlquiler),
        totalMes: new Decimal(computed.totalMes),
        neto: new Decimal(computed.neto),
        gastos: new Decimal(computed.gastos),
        neteado: new Decimal(computed.neteado),
        currency,
        notes: data.notes || null,
        items: items && items.length > 0
          ? {
              create: items.map(item => ({
                type: item.type,
                label: item.label,
                amount: new Decimal(typeof item.amount === "string" ? parseFloat(item.amount) : item.amount),
                currency,
                isDeduction: item.isDeduction || false,
              })),
            }
          : undefined,
      },
      include: {
        unit: {
          include: {
            propertyGroup: true,
          },
        },
        tenant: true,
        items: true,
      },
    })

    revalidatePath("/statements")
    revalidatePath("/bi")
    revalidatePath("/expenses")
    return convertStatementToClient(statement)
  }
}

/**
 * Obtiene una liquidación por ID
 */
export async function getStatement(id: string) {
  checkModelsAvailable()
  const userId = await getDefaultUserId()

  const statement = await (prisma as any).monthlyStatement.findFirst({
    where: {
      id,
      unit: {
        userId,
      },
    },
    include: {
      unit: {
        include: {
          propertyGroup: true,
        },
      },
      tenant: true,
      items: true,
    },
  })

  if (!statement) {
    return null
  }

  return convertStatementToClient(statement)
}

/**
 * Obtiene todas las liquidaciones de un período
 */
export async function getStatements(period: string) {
  // Verificar que el modelo existe, pero no lanzar error si no está disponible (retornar array vacío)
  if (!(prisma as any).monthlyStatement) {
    console.warn('MonthlyStatement model not available. Returning empty array. Please run "npm run db:generate" and restart the server.')
    return []
  }

  const userId = await getDefaultUserId()

  try {
    // Try to include propertyGroup, but fallback if relation is not available
    let statements
    try {
      statements = await (prisma as any).monthlyStatement.findMany({
        where: {
          period,
          unit: {
            userId,
          },
        },
        include: {
          unit: {
            include: {
              propertyGroup: true,
            },
          },
          tenant: true,
          items: true,
        },
        orderBy: [
          {
            unit: {
              propertyGroup: {
                name: "asc",
              },
            },
          },
          {
            unit: {
              name: "asc",
            },
          },
        ],
      })
    } catch (includeError: any) {
      // If propertyGroup relation fails, try without it
      if (includeError.message?.includes('propertyGroup') || 
          includeError.message?.includes('PropertyGroup') ||
          includeError.message?.includes('propertyGroupld') ||
          includeError.message?.includes('propertyGroupId') ||
          includeError.code === 'P2001') {
        console.warn('⚠️  PropertyGroup relation not available. Fetching statements without propertyGroup. Please run "npx prisma generate" and "npx prisma migrate dev"')
        statements = await (prisma as any).monthlyStatement.findMany({
          where: {
            period,
            unit: {
              userId,
            },
          },
          include: {
            unit: true,
            tenant: true,
            items: true,
          },
          orderBy: {
            unit: {
              name: "asc",
            },
          },
        })
      } else {
        throw includeError
      }
    }

    return statements.map(convertStatementToClient)
  } catch (error: any) {
    console.error('Error fetching statements:', error)
    // Si el error es porque el modelo no existe o no está disponible, retornar array vacío
    if (error.message?.includes('monthlyStatement') || 
        error.message?.includes('does not exist') ||
        error.code === 'P2001' ||
        error.name === 'PrismaClientKnownRequestError') {
      console.warn('MonthlyStatement model not available. Please run "npm run db:generate" and restart the server.')
      return []
    }
    // Para otros errores, relanzar
    throw error
  }
}

/**
 * Elimina una liquidación
 */
export async function deleteStatement(id: string) {
  checkModelsAvailable()
  const userId = await getDefaultUserId()

  const statement = await (prisma as any).monthlyStatement.findFirst({
    where: {
      id,
      unit: {
        userId,
      },
    },
  })

  if (!statement) {
    throw new Error("Liquidación no encontrada")
  }

  await (prisma as any).monthlyStatement.delete({
    where: { id },
  })

  revalidatePath("/statements")
}

/**
 * Convierte un statement de Prisma a formato cliente (Decimal -> number)
 */
function convertStatementToClient(statement: any) {
  // Asegurarse de convertir todos los Decimal a números
  const alquilerNum = decimalToNumber(statement.alquiler)
  const osseNum = decimalToNumber(statement.osse)
  const inmobNum = decimalToNumber(statement.inmob)
  const tsuNum = decimalToNumber(statement.tsu)
  const obrasNum = decimalToNumber(statement.obras)
  const otrosNum = decimalToNumber(statement.otrosTotal)
  const expensasNum = decimalToNumber(statement.expensas)
  const ivaNum = decimalToNumber(statement.ivaAlquiler)
  const totalMesNum = decimalToNumber(statement.totalMes)
  const netoNum = decimalToNumber(statement.neto)
  const gastosNum = decimalToNumber(statement.gastos)
  const neteadoNum = decimalToNumber(statement.neteado)
  
  // Convert unit object - CRITICAL: unit contains Decimal fields!
  const unit = statement.unit ? {
    id: String(statement.unit.id),
    userId: String(statement.unit.userId),
    name: String(statement.unit.name || ''),
    address: statement.unit.address ? String(statement.unit.address) : null,
    type: String(statement.unit.type),
    owner: statement.unit.owner ? String(statement.unit.owner) : null,
    propertyGroupId: statement.unit.propertyGroupId ? String(statement.unit.propertyGroupId) : null,
    propertyGroup: statement.unit.propertyGroup ? {
      id: String(statement.unit.propertyGroup.id),
      userId: String(statement.unit.propertyGroup.userId),
      name: String(statement.unit.propertyGroup.name || ''),
      createdAt: statement.unit.propertyGroup.createdAt instanceof Date 
        ? statement.unit.propertyGroup.createdAt.toISOString() 
        : String(statement.unit.propertyGroup.createdAt || ''),
      updatedAt: statement.unit.propertyGroup.updatedAt instanceof Date 
        ? statement.unit.propertyGroup.updatedAt.toISOString() 
        : String(statement.unit.propertyGroup.updatedAt || ''),
    } : null,
    notes: statement.unit.notes ? String(statement.unit.notes) : null,
    archived: Boolean(statement.unit.archived || false),
    aplicaIvaAlquiler: Boolean(statement.unit.aplicaIvaAlquiler || false),
    ivaRatePercent: decimalToNumber(statement.unit.ivaRatePercent),
    aplicaIibbRetencion: Boolean(statement.unit.aplicaIibbRetencion || false),
    igRatePercent: decimalToNumber(statement.unit.igRatePercent),
    iibbRatePercent: decimalToNumber(statement.unit.iibbRatePercent),
    monthlyExpensesAmount: decimalToNumber(statement.unit.monthlyExpensesAmount),
    createdAt: statement.unit.createdAt instanceof Date 
      ? statement.unit.createdAt.toISOString() 
      : String(statement.unit.createdAt || ''),
    updatedAt: statement.unit.updatedAt instanceof Date 
      ? statement.unit.updatedAt.toISOString() 
      : String(statement.unit.updatedAt || ''),
  } : null
  
  return {
    id: statement.id,
    period: statement.period,
    unitId: statement.unitId,
    tenantId: statement.tenantId,
    alquiler: alquilerNum !== null && alquilerNum !== undefined ? alquilerNum : 0,
    osse: osseNum !== null && osseNum !== undefined ? osseNum : null,
    inmob: inmobNum !== null && inmobNum !== undefined ? inmobNum : null,
    tsu: tsuNum !== null && tsuNum !== undefined ? tsuNum : null,
    obras: obrasNum !== null && obrasNum !== undefined ? obrasNum : null,
    otrosTotal: otrosNum !== null && otrosNum !== undefined ? otrosNum : null,
    expensas: expensasNum !== null && expensasNum !== undefined ? expensasNum : null,
    ivaAlquiler: ivaNum !== null && ivaNum !== undefined ? ivaNum : 0,
    totalMes: totalMesNum !== null && totalMesNum !== undefined ? totalMesNum : 0,
    neto: netoNum !== null && netoNum !== undefined ? netoNum : 0,
    gastos: gastosNum !== null && gastosNum !== undefined ? gastosNum : 0,
    neteado: neteadoNum !== null && neteadoNum !== undefined ? neteadoNum : 0,
    currency: statement.currency,
    notes: statement.notes,
    createdAt: statement.createdAt instanceof Date ? statement.createdAt.toISOString() : String(statement.createdAt || ''),
    updatedAt: statement.updatedAt instanceof Date ? statement.updatedAt.toISOString() : String(statement.updatedAt || ''),
    unit,
    tenant: statement.tenant ? {
      id: statement.tenant.id,
      name: statement.tenant.name,
      email: statement.tenant.email,
      phone: statement.tenant.phone,
      notes: statement.tenant.notes,
      createdAt: statement.tenant.createdAt instanceof Date ? statement.tenant.createdAt.toISOString() : String(statement.tenant.createdAt || ''),
      updatedAt: statement.tenant.updatedAt instanceof Date ? statement.tenant.updatedAt.toISOString() : String(statement.tenant.updatedAt || ''),
    } : null,
    items: statement.items?.map((item: any) => ({
      id: item.id,
      statementId: item.statementId,
      type: item.type,
      label: item.label,
      amount: decimalToNumber(item.amount) || 0,
      currency: item.currency,
      isDeduction: Boolean(item.isDeduction || false),
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt || ''),
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt || ''),
    })) || [],
  }
}
