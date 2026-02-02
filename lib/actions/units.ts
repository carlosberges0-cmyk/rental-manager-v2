"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"
import { getDefaultUserId } from "./auth-helper"

// Helper function to safely convert Decimal to number or null
function decimalToNumber(value: any): number | null {
  if (value === null || value === undefined) return null
  
  // Already a number
  if (typeof value === "number") {
    return isNaN(value) ? null : value
  }
  
  // Check if it has the Decimal signature (has toNumber method and is an object)
  // This check should come before instanceof because Prisma Decimal might not pass instanceof
  if (typeof value === "object" && value !== null && typeof value.toNumber === "function") {
    try {
      const num = value.toNumber()
      return isNaN(num) ? null : num
    } catch {
      // If toNumber fails, try toString then parseFloat as fallback
      try {
        const str = value.toString()
        const parsed = parseFloat(str)
        return isNaN(parsed) ? null : parsed
      } catch {
        return null
      }
    }
  }
  
  // Check if it's a Decimal instance (fallback)
  if (value instanceof Decimal) {
    try {
      return value.toNumber()
    } catch {
      return null
    }
  }
  
  // Try to parse as string
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed === "") return null
    const parsed = parseFloat(trimmed)
    return isNaN(parsed) ? null : parsed
  }
  
  return null
}

const unitSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  type: z.enum(["DEPTO", "CASA", "COCHERA", "VIVIENDA", "LOCAL_COMERCIAL", "OTRO"]),
  owner: z.string().optional().nullable(),
  propertyGroupId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  aplicaIvaAlquiler: z.boolean().optional(),
  ivaRatePercent: z.union([z.number(), z.string(), z.null()]).optional(),
  aplicaIibbRetencion: z.boolean().optional(),
  iibbRatePercent: z.union([z.number(), z.string(), z.null()]).optional(),
  igRatePercent: z.union([z.number(), z.string(), z.null()]).optional(),
  monthlyExpensesAmount: z.union([z.number(), z.string(), z.null()]).optional(),
})

export async function createUnit(data: z.infer<typeof unitSchema>) {
  const validated = unitSchema.parse(data)
  const userId = await getDefaultUserId()
  
  // Determinar valores por defecto según tipo de unidad
  const isVivienda = validated.type === "VIVIENDA" || validated.type === "DEPTO" || validated.type === "CASA"
  const isLocalComercial = validated.type === "LOCAL_COMERCIAL"
  
  // Defaults: vivienda no aplica IVA, local comercial sí (21%)
  const defaultAplicaIvaAlquiler = isLocalComercial ? true : (isVivienda ? false : (validated.aplicaIvaAlquiler ?? false))
  const defaultIvaRate = defaultAplicaIvaAlquiler ? (validated.ivaRatePercent ? (typeof validated.ivaRatePercent === "string" ? parseFloat(validated.ivaRatePercent) : validated.ivaRatePercent) : 21) : null
  
  const unit = await prisma.unit.create({
    data: {
      name: validated.name,
      address: validated.address || null,
      type: validated.type,
      owner: validated.owner || null,
      propertyGroupId: validated.propertyGroupId || null,
      notes: validated.notes || null,
      aplicaIvaAlquiler: validated.aplicaIvaAlquiler ?? defaultAplicaIvaAlquiler,
      ivaRatePercent: defaultIvaRate,
      aplicaIibbRetencion: validated.aplicaIibbRetencion ?? false,
      igRatePercent: validated.igRatePercent && validated.igRatePercent !== ""
        ? (typeof validated.igRatePercent === "string" ? parseFloat(validated.igRatePercent) : validated.igRatePercent)
        : null,
      iibbRatePercent: validated.iibbRatePercent && validated.iibbRatePercent !== ""
        ? (typeof validated.iibbRatePercent === "string" ? parseFloat(validated.iibbRatePercent) : validated.iibbRatePercent)
        : null,
      monthlyExpensesAmount: validated.monthlyExpensesAmount && validated.monthlyExpensesAmount !== ""
        ? (typeof validated.monthlyExpensesAmount === "string" ? parseFloat(validated.monthlyExpensesAmount) : validated.monthlyExpensesAmount)
        : null,
      userId,
    },
  })

  revalidatePath("/units")
  revalidatePath("/statements")
  revalidatePath("/calendar")
  revalidatePath("/expenses")

  // Convert Decimal to number for client components - build new object explicitly
  return {
    id: unit.id,
    userId: unit.userId,
    name: unit.name,
    address: unit.address,
    type: unit.type,
    notes: unit.notes,
    archived: unit.archived,
    ivaRatePercent: decimalToNumber(unit.ivaRatePercent),
    igRatePercent: decimalToNumber(unit.igRatePercent),
    iibbRatePercent: decimalToNumber(unit.iibbRatePercent),
    monthlyExpensesAmount: decimalToNumber(unit.monthlyExpensesAmount),
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  }
}

export async function updateUnit(id: string, data: z.infer<typeof unitSchema>) {
  try {
    const validated = unitSchema.parse(data)
    
    // Helper function to parse percentage value to number or null (never undefined)
    const parsePercentage = (value: string | number | null | undefined): number | null => {
      if (value === undefined || value === "" || value === null) return null
      if (typeof value === "string") {
        const trimmed = value.trim()
        if (trimmed === "") return null
        const parsed = parseFloat(trimmed)
        return isNaN(parsed) ? null : parsed
      }
      return typeof value === "number" ? value : null
    }

    // Build update data object
    const updateData: {
      name: string
      address: string | null
      type: "DEPTO" | "CASA" | "COCHERA" | "VIVIENDA" | "LOCAL_COMERCIAL" | "OTRO"
      owner: string | null
      propertyGroupId: string | null
      notes: string | null
      aplicaIvaAlquiler?: boolean
      ivaRatePercent: number | null
      aplicaIibbRetencion?: boolean
      igRatePercent: number | null
      iibbRatePercent: number | null
      monthlyExpensesAmount: number | null
    } = {
      name: validated.name,
      address: validated.address || null,
      type: validated.type,
      owner: validated.owner || null,
      propertyGroupId: validated.propertyGroupId || null,
      notes: validated.notes || null,
      aplicaIvaAlquiler: validated.aplicaIvaAlquiler,
      ivaRatePercent: parsePercentage(validated.ivaRatePercent),
      aplicaIibbRetencion: validated.aplicaIibbRetencion,
      igRatePercent: parsePercentage(validated.igRatePercent),
      iibbRatePercent: parsePercentage(validated.iibbRatePercent),
      monthlyExpensesAmount: parsePercentage(validated.monthlyExpensesAmount),
    }
    
    // Try to update, but if some fields don't exist in DB yet, remove them
    let unit
    try {
      unit = await prisma.unit.update({
        where: { id },
        data: updateData,
      })
    } catch (error: any) {
      // If error is about fields not existing, try with only basic fields
      const errorMessage = error.message || error.toString() || ''
      const missingFields = ['monthlyExpensesAmount', 'aplicaIvaAlquiler', 'aplicaIibbRetencion', 'owner', 'propertyGroupId']
      const hasMissingField = missingFields.some(field => errorMessage.includes(field))
      
      if (hasMissingField) {
        // Build a safe update object with only fields that definitely exist
        const safeUpdateData: any = {
          name: updateData.name,
          address: updateData.address,
          type: updateData.type,
          notes: updateData.notes,
        }
        
        // Only include fields that are likely to exist in older migrations
        if (updateData.ivaRatePercent !== undefined && updateData.ivaRatePercent !== null) {
          safeUpdateData.ivaRatePercent = updateData.ivaRatePercent
        }
        if (updateData.igRatePercent !== undefined && updateData.igRatePercent !== null) {
          safeUpdateData.igRatePercent = updateData.igRatePercent
        }
        if (updateData.iibbRatePercent !== undefined && updateData.iibbRatePercent !== null) {
          safeUpdateData.iibbRatePercent = updateData.iibbRatePercent
        }
        
        unit = await prisma.unit.update({
          where: { id },
          data: safeUpdateData,
        })
        
        // Manually set missing fields to null in the returned object
        ;(unit as any).monthlyExpensesAmount = null
        ;(unit as any).aplicaIvaAlquiler = false
        ;(unit as any).aplicaIibbRetencion = false
        ;(unit as any).owner = null
        ;(unit as any).propertyGroupId = null
      } else {
        throw error
      }
    }

    revalidatePath("/units")
    revalidatePath("/statements")
    revalidatePath("/calendar")
    revalidatePath("/expenses")
    revalidatePath("/bi")

    // Convert Decimal to number for client components - build new object explicitly
    return {
      id: unit.id,
      userId: unit.userId,
      name: unit.name,
      address: unit.address,
      type: unit.type,
      owner: (unit as any).owner || null,
      propertyGroupId: (unit as any).propertyGroupId || null,
      notes: unit.notes,
      archived: unit.archived,
      aplicaIvaAlquiler: (unit as any).aplicaIvaAlquiler ?? false,
      ivaRatePercent: decimalToNumber(unit.ivaRatePercent),
      aplicaIibbRetencion: (unit as any).aplicaIibbRetencion ?? false,
      igRatePercent: decimalToNumber(unit.igRatePercent),
      iibbRatePercent: decimalToNumber(unit.iibbRatePercent),
      monthlyExpensesAmount: decimalToNumber((unit as any).monthlyExpensesAmount),
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    }
  } catch (error: any) {
    console.error("Error updating unit:", error)
    throw new Error(error.message || "No se pudo actualizar la unidad")
  }
}

export async function deleteUnit(id: string) {
  await prisma.unit.update({
    where: { id },
    data: { archived: true },
  })

  revalidatePath("/units")
  revalidatePath("/statements")
  revalidatePath("/calendar")
  revalidatePath("/expenses")
}

export async function getUnits() {
  try {
    // Obtener userId de la sesión
    const userId = await getDefaultUserId()
    
    // Verificar que el modelo unit esté disponible
    if (!prisma.unit) {
      console.error('❌ Unit model not available in Prisma Client. Please run "npm run db:generate" and restart the server.')
      return []
    }

    // Fetch units with propertyGroup for display in statements/lists
    let units
    try {
      const rawUnits = await prisma.unit.findMany({
        where: { 
          userId,
          archived: false 
        },
        include: {
          propertyGroup: true,
        },
        orderBy: { name: "asc" },
      })
      units = rawUnits.map((u: any) => {
        const converted: any = { ...u }
        if (converted.ivaRatePercent && typeof converted.ivaRatePercent.toNumber === 'function') {
          converted.ivaRatePercent = converted.ivaRatePercent.toNumber()
        }
        if (converted.iibbRatePercent && typeof converted.iibbRatePercent.toNumber === 'function') {
          converted.iibbRatePercent = converted.iibbRatePercent.toNumber()
        }
        if (converted.igRatePercent && typeof converted.igRatePercent.toNumber === 'function') {
          converted.igRatePercent = converted.igRatePercent.toNumber()
        }
        if (converted.monthlyExpensesAmount && typeof converted.monthlyExpensesAmount.toNumber === 'function') {
          converted.monthlyExpensesAmount = converted.monthlyExpensesAmount.toNumber()
        }
        return converted
      })
    } catch (fetchError: any) {
      // Fallback: try without propertyGroup if relation fails
      if (fetchError.message?.includes('propertyGroup') || fetchError.code === 'P2001') {
        const rawUnits = await prisma.unit.findMany({
          where: { userId, archived: false },
          orderBy: { name: "asc" },
        })
        units = rawUnits.map((u: any) => {
          const converted: any = { ...u }
          if (converted.ivaRatePercent && typeof converted.ivaRatePercent?.toNumber === 'function') {
            converted.ivaRatePercent = converted.ivaRatePercent.toNumber()
          }
          if (converted.iibbRatePercent && typeof converted.iibbRatePercent?.toNumber === 'function') {
            converted.iibbRatePercent = converted.iibbRatePercent.toNumber()
          }
          if (converted.igRatePercent && typeof converted.igRatePercent?.toNumber === 'function') {
            converted.igRatePercent = converted.igRatePercent.toNumber()
          }
          if (converted.monthlyExpensesAmount && typeof converted.monthlyExpensesAmount?.toNumber === 'function') {
            converted.monthlyExpensesAmount = converted.monthlyExpensesAmount.toNumber()
          }
          return converted
        })
      } else {
        throw fetchError
      }
    }

    // Convert Decimal to number for client components - ULTRA SIMPLE VERSION
    // Convert ALL Decimal fields immediately and return plain objects
    return units.map((unit: any) => {
      // Helper to convert ANY value that might be Decimal to number
      const forceToNumber = (val: any): number | null => {
        if (val === null || val === undefined) return null
        if (typeof val === 'number') return isNaN(val) ? null : val
        // If it has toNumber method, use it immediately
        if (val && typeof val === 'object' && typeof val.toNumber === 'function') {
          try {
            const num = val.toNumber()
            return typeof num === 'number' && !isNaN(num) ? num : null
          } catch {
            return null
          }
        }
        // Try to parse as string
        if (typeof val === 'string') {
          const parsed = parseFloat(val)
          return isNaN(parsed) ? null : parsed
        }
        return null
      }
      
      // Convert propertyGroup to plain object
      const pg = unit.propertyGroup
      const propertyGroup = pg ? {
        id: String(pg.id || ''),
        userId: String(pg.userId || ''),
        name: String(pg.name || ''),
        createdAt: pg.createdAt instanceof Date ? pg.createdAt.toISOString() : String(pg.createdAt || ''),
        updatedAt: pg.updatedAt instanceof Date ? pg.updatedAt.toISOString() : String(pg.updatedAt || ''),
      } : null
      
      // Build completely plain object - convert ALL Decimal fields immediately
      const result = {
        id: String(unit.id),
        userId: String(unit.userId),
        name: String(unit.name || ''),
        address: unit.address ? String(unit.address) : null,
        type: String(unit.type),
        owner: unit.owner ? String(unit.owner) : null,
        propertyGroupId: unit.propertyGroupId ? String(unit.propertyGroupId) : null,
        propertyGroup,
        notes: unit.notes ? String(unit.notes) : null,
        archived: Boolean(unit.archived || false),
        aplicaIvaAlquiler: Boolean(unit.aplicaIvaAlquiler || false),
        ivaRatePercent: forceToNumber(unit.ivaRatePercent),
        aplicaIibbRetencion: Boolean(unit.aplicaIibbRetencion || false),
        igRatePercent: forceToNumber(unit.igRatePercent),
        iibbRatePercent: forceToNumber(unit.iibbRatePercent),
        monthlyExpensesAmount: forceToNumber(unit.monthlyExpensesAmount),
        createdAt: unit.createdAt instanceof Date ? unit.createdAt.toISOString() : String(unit.createdAt || ''),
        updatedAt: unit.updatedAt instanceof Date ? unit.updatedAt.toISOString() : String(unit.updatedAt || ''),
      }
      
      // Final verification: ensure NO Decimal objects remain
      // Recursively check and convert any remaining Decimal
      const finalCheck = (obj: any): any => {
        if (obj === null || obj === undefined) return obj
        if (typeof obj === 'number' || typeof obj === 'string' || typeof obj === 'boolean') return obj
        if (obj instanceof Date) return obj.toISOString()
        // Check for Decimal
        if (typeof obj === 'object' && typeof obj.toNumber === 'function') {
          try {
            return obj.toNumber()
          } catch {
            return null
          }
        }
        if (Array.isArray(obj)) {
          return obj.map(item => finalCheck(item))
        }
        if (typeof obj === 'object') {
          const cleaned: any = {}
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              cleaned[key] = finalCheck(obj[key])
            }
          }
          return cleaned
        }
        return obj
      }
      
      return finalCheck(result)
    })
  } catch (error: any) {
    console.error('❌ Error fetching units:', error.message || error)
    
    // Si el error es porque el modelo unit no está disponible
    if (error.message?.includes('unit') || error.message?.includes('Unit') || error.code === 'P2001') {
      console.error('❌ Unit model not available in Prisma Client. Please run "npm run db:generate" and restart the server.')
      return []
    }
    
    // Para otros errores, relanzar
    throw error
  }
}

export async function getUnit(id: string) {
  const userId = await getDefaultUserId()
  
  const unit = await prisma.unit.findFirst({
    where: { 
      id,
      userId,
    },
  })
  
  if (!unit) return null
  
  // Convert Decimal to number for client components - build new object explicitly
  return {
    id: unit.id,
    userId: unit.userId,
    name: unit.name,
    address: unit.address,
    type: unit.type,
    owner: (unit as any).owner || null,
    propertyGroupId: (unit as any).propertyGroupId || null,
    notes: unit.notes,
    archived: unit.archived,
    aplicaIvaAlquiler: (unit as any).aplicaIvaAlquiler ?? false,
    ivaRatePercent: decimalToNumber(unit.ivaRatePercent),
    aplicaIibbRetencion: (unit as any).aplicaIibbRetencion ?? false,
    igRatePercent: decimalToNumber(unit.igRatePercent),
    iibbRatePercent: decimalToNumber(unit.iibbRatePercent),
    monthlyExpensesAmount: decimalToNumber(unit.monthlyExpensesAmount),
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  }
}

export async function getUnitsWithRentalPeriods() {
  const userId = await getDefaultUserId()
  
  // Get units that have at least one rental period (active, reserved, or past)
  const units = await prisma.unit.findMany({
    where: {
      userId,
      archived: false,
      rentalPeriods: {
        some: {
          status: {
            in: ["ACTIVE", "RESERVED"],
          },
        },
      },
    },
    include: {
      rentalPeriods: {
        where: {
          status: {
            in: ["ACTIVE", "RESERVED"],
          },
        },
        orderBy: { startDate: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  })

  // Convert Decimal to number for client components - build new objects explicitly
  type UnitWithPeriods = {
    id: string
    userId: string
    name: string
    address: string | null
    type: string
    notes: string | null
    archived: boolean
    ivaRatePercent?: unknown
    igRatePercent?: unknown
    iibbRatePercent?: unknown
    createdAt: Date
    updatedAt: Date
    rentalPeriods: Array<{
      id: string
      unitId: string
      tenantId: string | null
      startDate: Date
      endDate: Date
      priceAmount?: unknown
      currency: string
      billingFrequency: string
      status: string
      notes: string | null
      exemptFromIVA: boolean
      createdAt: Date
      updatedAt: Date
    }>
  }
  return units.map((unit: UnitWithPeriods) => ({
    id: unit.id,
    userId: unit.userId,
    name: unit.name,
    address: unit.address,
    type: unit.type,
    notes: unit.notes,
    archived: unit.archived,
    ivaRatePercent: decimalToNumber(unit.ivaRatePercent),
    igRatePercent: decimalToNumber(unit.igRatePercent),
    iibbRatePercent: decimalToNumber(unit.iibbRatePercent),
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    rentalPeriods: unit.rentalPeriods.map((period: UnitWithPeriods["rentalPeriods"][number]) => ({
      id: period.id,
      unitId: period.unitId,
      tenantId: period.tenantId,
      startDate: period.startDate,
      endDate: period.endDate,
      priceAmount: decimalToNumber(period.priceAmount),
      currency: period.currency,
      billingFrequency: period.billingFrequency,
      status: period.status,
      notes: period.notes,
      exemptFromIVA: period.exemptFromIVA,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    })),
  }))
}
