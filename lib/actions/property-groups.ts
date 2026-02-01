"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"
import { getDefaultUserId } from "./auth-helper"

const propertyGroupSchema = z.object({
  name: z.string().min(1),
})

/**
 * Crea un grupo de propiedades
 */
export async function createPropertyGroup(data: z.infer<typeof propertyGroupSchema>) {
  // @ts-ignore
  if (typeof prisma.propertyGroup === 'undefined') {
    console.error('❌ PropertyGroup model is not available. Please run "npx prisma generate" and "npx prisma migrate dev"')
    throw new Error('PropertyGroup model is not available. Please run "npx prisma generate" and "npx prisma migrate dev"')
  }

  const userId = await getDefaultUserId()

  // @ts-ignore
  const group = await prisma.propertyGroup.create({
    data: {
      userId,
      name: data.name,
    },
  })

  revalidatePath("/units")
  return group
}

/**
 * Obtiene todos los grupos de propiedades del usuario
 */
export async function getPropertyGroups() {
  // @ts-ignore
  if (typeof prisma.propertyGroup === 'undefined') {
    console.warn('⚠️  PropertyGroup model is not available. Returning empty array. Please run "npx prisma generate" and "npx prisma migrate dev"')
    return []
  }

  const userId = await getDefaultUserId()

  // @ts-ignore
  const groups = await prisma.propertyGroup.findMany({
    where: { userId },
    include: {
      units: {
        where: { archived: false },
      },
    },
    orderBy: { name: "asc" },
  })

  // Helper function to convert Decimal to number
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

  // Convert all Decimal fields to numbers for Client Components
  type GroupInput = {
    id: string
    userId: string
    name: string
    createdAt?: Date | string | null
    updatedAt?: Date | string | null
    units?: Array<Record<string, unknown>>
  }
  return groups.map((group: GroupInput) => ({
    id: group.id,
    userId: group.userId,
    name: group.name,
    createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : (group.createdAt ? String(group.createdAt) : null),
    updatedAt: group.updatedAt instanceof Date ? group.updatedAt.toISOString() : (group.updatedAt ? String(group.updatedAt) : null),
    units: group.units?.map((unit: Record<string, unknown>) => ({
      id: unit.id,
      userId: unit.userId,
      name: unit.name,
      address: unit.address || null,
      type: unit.type,
      owner: unit.owner || null,
      propertyGroupId: unit.propertyGroupId || null,
      notes: unit.notes || null,
      archived: unit.archived,
      aplicaIvaAlquiler: unit.aplicaIvaAlquiler || false,
      ivaRatePercent: decimalToNumber(unit.ivaRatePercent),
      aplicaIibbRetencion: unit.aplicaIibbRetencion || false,
      iibbRatePercent: decimalToNumber(unit.iibbRatePercent),
      igRatePercent: decimalToNumber(unit.igRatePercent),
      monthlyExpensesAmount: decimalToNumber(unit.monthlyExpensesAmount),
      createdAt: unit.createdAt instanceof Date ? unit.createdAt.toISOString() : (unit.createdAt ? String(unit.createdAt) : null),
      updatedAt: unit.updatedAt instanceof Date ? unit.updatedAt.toISOString() : (unit.updatedAt ? String(unit.updatedAt) : null),
    })) || [],
  }))
}

/**
 * Actualiza un grupo de propiedades
 */
export async function updatePropertyGroup(
  id: string,
  data: z.infer<typeof propertyGroupSchema>
) {
  // @ts-ignore
  if (typeof prisma.propertyGroup === 'undefined') {
    console.error('❌ PropertyGroup model is not available. Please run "npx prisma generate" and "npx prisma migrate dev"')
    throw new Error('PropertyGroup model is not available. Please run "npx prisma generate" and "npx prisma migrate dev"')
  }

  const userId = await getDefaultUserId()

  // @ts-ignore
  const group = await prisma.propertyGroup.findFirst({
    where: {
      id,
      userId,
    },
  })

  if (!group) {
    throw new Error("Grupo no encontrado")
  }

  // @ts-ignore
  const updated = await prisma.propertyGroup.update({
    where: { id },
    data: {
      name: data.name,
    },
  })

  revalidatePath("/units")
  return updated
}

/**
 * Elimina un grupo de propiedades
 */
export async function deletePropertyGroup(id: string) {
  // @ts-ignore
  if (typeof prisma.propertyGroup === 'undefined') {
    console.error('❌ PropertyGroup model is not available. Please run "npx prisma generate" and "npx prisma migrate dev"')
    throw new Error('PropertyGroup model is not available. Please run "npx prisma generate" and "npx prisma migrate dev"')
  }

  const userId = await getDefaultUserId()

  // @ts-ignore
  const group = await prisma.propertyGroup.findFirst({
    where: {
      id,
      userId,
    },
  })

  if (!group) {
    throw new Error("Grupo no encontrado")
  }

  // @ts-ignore
  await prisma.propertyGroup.delete({
    where: { id },
  })

  revalidatePath("/units")
}
