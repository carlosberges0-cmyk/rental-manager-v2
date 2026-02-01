"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"
import { getDefaultUserId } from "./auth-helper"

const rentalPeriodSchema = z.object({
  unitId: z.string(),
  tenantId: z.string().optional(),
  tenantName: z.string().optional(), // Nombre del inquilino como texto libre
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  priceAmount: z.number().or(z.string()),
  currency: z.enum(["ARS", "USD"]),
  billingFrequency: z.enum(["MONTHLY", "WEEKLY", "DAILY", "ONE_TIME"]),
  status: z.enum(["RESERVED", "ACTIVE", "CANCELLED"]),
  notes: z.string().optional(),
  exemptFromIVA: z.boolean().optional(),
})

export async function createRentalPeriod(data: z.infer<typeof rentalPeriodSchema>) {
  // Verify unit exists
  const unit = await prisma.unit.findFirst({
    where: { id: data.unitId },
  })
  if (!unit) throw new Error("Unit not found")

  // Check for conflicts
  const conflicts = await prisma.rentalPeriod.findMany({
    where: {
      unitId: data.unitId,
      status: { not: "CANCELLED" },
      OR: [
        {
          AND: [
            { startDate: { lte: new Date(data.endDate) } },
            { endDate: { gte: new Date(data.startDate) } },
          ],
        },
      ],
    },
  })

  if (conflicts.length > 0) {
    throw new Error("Conflicto: Ya existe un alquiler activo en este período")
  }

  const validated = rentalPeriodSchema.parse(data)
  
  // Si se proporciona tenantName pero no tenantId, crear o buscar el tenant
  let finalTenantId = validated.tenantId
  if (validated.tenantName && validated.tenantName.trim() && !validated.tenantId) {
    // Buscar si ya existe un tenant con ese nombre
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        name: {
          equals: validated.tenantName.trim(),
          mode: "insensitive",
        },
      },
    })
    
    if (existingTenant) {
      finalTenantId = existingTenant.id
    } else {
      // Crear nuevo tenant
      const newTenant = await prisma.tenant.create({
        data: {
          name: validated.tenantName.trim(),
        },
      })
      finalTenantId = newTenant.id
    }
  }
  
  const rentalPeriod = await prisma.rentalPeriod.create({
    data: {
      unitId: validated.unitId,
      tenantId: finalTenantId || null,
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate),
      priceAmount: typeof validated.priceAmount === "string" 
        ? parseFloat(validated.priceAmount) 
        : validated.priceAmount,
      currency: validated.currency,
      billingFrequency: validated.billingFrequency,
      status: validated.status,
      notes: validated.notes || null,
      exemptFromIVA: validated.exemptFromIVA ?? false,
    },
    include: {
      unit: true,
      tenant: true,
    },
  })

  revalidatePath("/calendar")
  
  // Helper function to safely convert Decimal to number
  const decimalToNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null
    if (value instanceof Decimal) return value.toNumber()
    if (typeof value === "object" && value !== null && typeof value.toNumber === "function") {
      try { return value.toNumber() } catch { return null }
    }
    if (typeof value === "number") return isNaN(value) ? null : value
    if (typeof value === "string") {
      const parsed = parseFloat(value.trim())
      return isNaN(parsed) ? null : parsed
    }
    return null
  }
  
  // Convert Decimal to number for client components - build new object explicitly
  return {
    id: rentalPeriod.id,
    unitId: rentalPeriod.unitId,
    tenantId: rentalPeriod.tenantId,
    startDate: rentalPeriod.startDate,
    endDate: rentalPeriod.endDate,
    priceAmount: decimalToNumber(rentalPeriod.priceAmount) || 0,
    currency: rentalPeriod.currency,
    billingFrequency: rentalPeriod.billingFrequency,
    status: rentalPeriod.status,
    notes: rentalPeriod.notes,
    exemptFromIVA: rentalPeriod.exemptFromIVA,
    createdAt: rentalPeriod.createdAt,
    updatedAt: rentalPeriod.updatedAt,
    unit: rentalPeriod.unit ? {
      id: rentalPeriod.unit.id,
      userId: rentalPeriod.unit.userId,
      name: rentalPeriod.unit.name,
      address: rentalPeriod.unit.address,
      type: rentalPeriod.unit.type,
      notes: rentalPeriod.unit.notes,
      archived: rentalPeriod.unit.archived,
      ivaRatePercent: decimalToNumber((rentalPeriod.unit as any).ivaRatePercent),
      igRatePercent: decimalToNumber((rentalPeriod.unit as any).igRatePercent),
      iibbRatePercent: decimalToNumber((rentalPeriod.unit as any).iibbRatePercent),
      monthlyExpensesAmount: decimalToNumber((rentalPeriod.unit as any).monthlyExpensesAmount),
      createdAt: rentalPeriod.unit.createdAt,
      updatedAt: rentalPeriod.unit.updatedAt,
    } : null,
    tenant: rentalPeriod.tenant,
  }
}

export async function updateRentalPeriod(
  id: string,
  data: Partial<z.infer<typeof rentalPeriodSchema>>
) {
  // Get existing rental period
  const existing = await prisma.rentalPeriod.findFirst({
    where: { id },
    include: { unit: true },
  })
  if (!existing) {
    throw new Error("Rental period not found")
  }

  // Check for conflicts if dates are being changed
  if (data.startDate || data.endDate) {
    const startDate = data.startDate ? new Date(data.startDate) : existing.startDate
    const endDate = data.endDate ? new Date(data.endDate) : existing.endDate
    const unitId = data.unitId || existing.unitId

    const conflicts = await prisma.rentalPeriod.findMany({
      where: {
        id: { not: id },
        unitId,
        status: { not: "CANCELLED" },
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
        ],
      },
    })

    if (conflicts.length > 0) {
      throw new Error("Conflicto: Ya existe un alquiler activo en este período")
    }
  }

  const updateData: any = {}
  if (data.startDate) updateData.startDate = new Date(data.startDate)
  if (data.endDate) updateData.endDate = new Date(data.endDate)
  if (data.priceAmount !== undefined) {
    updateData.priceAmount = typeof data.priceAmount === "string"
      ? parseFloat(data.priceAmount)
      : data.priceAmount
  }
  if (data.unitId) updateData.unitId = data.unitId
  if (data.tenantId !== undefined) updateData.tenantId = data.tenantId
  if (data.currency) updateData.currency = data.currency
  if (data.billingFrequency) updateData.billingFrequency = data.billingFrequency
  if (data.status) updateData.status = data.status
  if (data.notes !== undefined) updateData.notes = data.notes
  if (data.exemptFromIVA !== undefined) updateData.exemptFromIVA = data.exemptFromIVA

  const rentalPeriod = await prisma.rentalPeriod.update({
    where: { id },
    data: updateData,
    include: {
      unit: true,
      tenant: true,
    },
  })

  revalidatePath("/calendar")
  
  // Helper function to safely convert Decimal to number
  const decimalToNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null
    if (value instanceof Decimal) return value.toNumber()
    if (typeof value === "object" && value !== null && typeof value.toNumber === "function") {
      try { return value.toNumber() } catch { return null }
    }
    if (typeof value === "number") return isNaN(value) ? null : value
    if (typeof value === "string") {
      const parsed = parseFloat(value.trim())
      return isNaN(parsed) ? null : parsed
    }
    return null
  }
  
  // Convert Decimal to number for client components - build new object explicitly
  return {
    id: rentalPeriod.id,
    unitId: rentalPeriod.unitId,
    tenantId: rentalPeriod.tenantId,
    startDate: rentalPeriod.startDate,
    endDate: rentalPeriod.endDate,
    priceAmount: decimalToNumber(rentalPeriod.priceAmount) || 0,
    currency: rentalPeriod.currency,
    billingFrequency: rentalPeriod.billingFrequency,
    status: rentalPeriod.status,
    notes: rentalPeriod.notes,
    exemptFromIVA: rentalPeriod.exemptFromIVA,
    createdAt: rentalPeriod.createdAt,
    updatedAt: rentalPeriod.updatedAt,
    unit: rentalPeriod.unit ? {
      id: rentalPeriod.unit.id,
      userId: rentalPeriod.unit.userId,
      name: rentalPeriod.unit.name,
      address: rentalPeriod.unit.address,
      type: rentalPeriod.unit.type,
      notes: rentalPeriod.unit.notes,
      archived: rentalPeriod.unit.archived,
      ivaRatePercent: decimalToNumber((rentalPeriod.unit as any).ivaRatePercent),
      igRatePercent: decimalToNumber((rentalPeriod.unit as any).igRatePercent),
      iibbRatePercent: decimalToNumber((rentalPeriod.unit as any).iibbRatePercent),
      monthlyExpensesAmount: decimalToNumber((rentalPeriod.unit as any).monthlyExpensesAmount),
      createdAt: rentalPeriod.unit.createdAt,
      updatedAt: rentalPeriod.unit.updatedAt,
    } : null,
    tenant: rentalPeriod.tenant,
  }
}

export async function deleteRentalPeriod(id: string) {
  const existing = await prisma.rentalPeriod.findFirst({
    where: { id },
  })
  if (!existing) {
    throw new Error("Rental period not found")
  }

  await prisma.rentalPeriod.delete({
    where: { id },
  })

  revalidatePath("/calendar")
}

export async function getRentalPeriods(unitId?: string, startDate?: Date, endDate?: Date) {
  const userId = await getDefaultUserId()
  
  // Verificar que el modelo rentalPeriod esté disponible
  if (!prisma.rentalPeriod) {
    console.warn('⚠️  RentalPeriod model not available in Prisma Client. Please run "npm run db:generate" and restart the server.')
    return []
  }

  const where: any = {
    unit: {
      userId,
    }
  }

  if (unitId) where.unitId = unitId
  if (startDate && endDate) {
    where.OR = [
      {
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
    ]
  }

  try {
    const periods = await prisma.rentalPeriod.findMany({
      where,
      include: {
        unit: true,
        tenant: true,
      },
      orderBy: { startDate: "asc" },
    })

    // Helper function to safely convert Decimal to number
    const decimalToNumber = (value: any): number | null => {
      if (value === null || value === undefined) return null
      if (value instanceof Decimal) return value.toNumber()
      if (typeof value === "object" && value !== null && typeof value.toNumber === "function") {
        try { return value.toNumber() } catch { return null }
      }
      if (typeof value === "number") return isNaN(value) ? null : value
      if (typeof value === "string") {
        const parsed = parseFloat(value.trim())
        return isNaN(parsed) ? null : parsed
      }
      return null
    }

    // Convert Decimal to number for client components - build new objects explicitly
    type PeriodInput = {
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
      unit?: { id: string; userId: string; name: string; address: string | null; type: string; notes: string | null; archived: boolean; createdAt: Date; updatedAt: Date; ivaRatePercent?: unknown; igRatePercent?: unknown; iibbRatePercent?: unknown; monthlyExpensesAmount?: unknown } | null
      tenant?: { id: string; name: string; documentId: string | null; email: string | null; phone: string | null; createdAt: Date; updatedAt: Date } | null
    }
    return periods.map((period: PeriodInput) => ({
      id: period.id,
      unitId: period.unitId,
      tenantId: period.tenantId,
      startDate: period.startDate,
      endDate: period.endDate,
      priceAmount: decimalToNumber(period.priceAmount) || 0,
      currency: period.currency,
      billingFrequency: period.billingFrequency,
      status: period.status,
      notes: period.notes,
      exemptFromIVA: period.exemptFromIVA,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
      // Build unit object explicitly
      unit: period.unit ? {
        id: period.unit.id,
        userId: period.unit.userId,
        name: period.unit.name,
        address: period.unit.address,
        type: period.unit.type,
        notes: period.unit.notes,
        archived: period.unit.archived,
        ivaRatePercent: decimalToNumber(period.unit.ivaRatePercent),
        igRatePercent: decimalToNumber(period.unit.igRatePercent),
        iibbRatePercent: decimalToNumber(period.unit.iibbRatePercent),
        monthlyExpensesAmount: decimalToNumber(period.unit.monthlyExpensesAmount),
        createdAt: period.unit.createdAt,
        updatedAt: period.unit.updatedAt,
      } : null,
      tenant: period.tenant ? {
        id: period.tenant.id,
        name: period.tenant.name,
        documentId: period.tenant.documentId,
        email: period.tenant.email,
        phone: period.tenant.phone,
        createdAt: period.tenant.createdAt,
        updatedAt: period.tenant.updatedAt,
      } : null,
    }))
  } catch (error: any) {
    console.error('❌ Error fetching rental periods:', error.message || error)
    // Si el error es porque el modelo no está disponible o hay un problema con propertyGroup, retornar array vacío
    if (error.message?.includes('rentalPeriod') || 
        error.message?.includes('does not exist') ||
        error.message?.includes('propertyGroup') ||
        error.message?.includes('PropertyGroup') ||
        error.message?.includes('propertyGroupld') ||
        error.message?.includes('propertyGroupId') ||
        error.code === 'P2001') {
      console.warn('⚠️  Error fetching rental periods. Please run "npx prisma generate" and "npx prisma migrate dev"')
      return []
    }
    throw error
  }
}

export async function getRentalPeriod(id: string) {
  const userId = await getDefaultUserId()
  
  const period = await prisma.rentalPeriod.findFirst({
    where: { 
      id,
      unit: {
        userId,
      }
    },
    include: {
      unit: true,
      tenant: true,
    },
  })

  if (!period) return null

  // Convert Decimal to number for client components
  return {
    ...period,
    priceAmount: period.priceAmount instanceof Decimal 
      ? period.priceAmount.toNumber() 
      : typeof period.priceAmount === 'string' 
        ? parseFloat(period.priceAmount) 
        : period.priceAmount,
  }
}
