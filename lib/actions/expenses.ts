"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"
import { getDefaultUserId } from "./auth-helper"

const expenseSchema = z.object({
  unitId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  date: z.string().or(z.date()).optional(),
  category: z.enum(["OSSE", "INMOB", "TSU", "OBRAS", "OTROS"]),
  description: z.string().optional().default(""),
  amount: z.number().or(z.string()),
  currency: z.enum(["ARS", "USD"]),
  deductibleFlag: z.boolean().optional(),
  paidByTenant: z.boolean().optional(),
  vendor: z.string().optional(),
})

// Helper function to calculate taxes and total
function calculateExpenseTotals(amount: number, ivaPercent?: number | string, igPercent?: number | string, iibbPercent?: number | string) {
  const baseAmount = amount
  const ivaRate = ivaPercent ? (typeof ivaPercent === "string" ? parseFloat(ivaPercent) : ivaPercent) / 100 : 0
  const igRate = igPercent ? (typeof igPercent === "string" ? parseFloat(igPercent) : igPercent) / 100 : 0
  const iibbRate = iibbPercent ? (typeof iibbPercent === "string" ? parseFloat(iibbPercent) : iibbPercent) / 100 : 0

  const ivaAmount = baseAmount * ivaRate
  const igAmount = baseAmount * igRate
  const iibbAmount = baseAmount * iibbRate
  const totalAmount = baseAmount + ivaAmount + igAmount + iibbAmount

  return {
    ivaAmount: ivaAmount || null,
    igAmount: igAmount || null,
    iibbAmount: iibbAmount || null,
    totalAmount,
    ivaRatePercent: ivaRate * 100 || null,
    igRatePercent: igRate * 100 || null,
    iibbRatePercent: iibbRate * 100 || null,
  }
}

export async function createExpense(data: z.infer<typeof expenseSchema>) {
  // Verify unit exists
  const unit = await prisma.unit.findFirst({
    where: { id: data.unitId },
  })
  if (!unit) throw new Error("Unit not found")

  const validated = expenseSchema.parse(data)
  const amount = typeof validated.amount === "string" ? parseFloat(validated.amount) : validated.amount

  const expenseDate = validated.date
    ? (validated.date instanceof Date ? validated.date : new Date(validated.date))
    : new Date()
  
  const expense = await prisma.monthlyExpense.create({
    data: {
      unitId: validated.unitId,
      month: validated.month,
      date: expenseDate,
      category: validated.category,
      description: validated.description?.trim() || null,
      amount,
      currency: validated.currency,
      deductibleFlag: validated.deductibleFlag ?? false,
      paidByTenant: validated.paidByTenant ?? false,
      vendor: validated.vendor,
      // Expenses don't have taxes - set to null
      ivaRatePercent: null,
      ivaAmount: null,
      igRatePercent: null,
      igAmount: null,
      iibbRatePercent: null,
      iibbAmount: null,
      totalAmount: amount, // Total is just the base amount
    },
    include: {
      unit: true,
    },
  })

  revalidatePath("/expenses")
  revalidatePath("/calendar")
  revalidatePath("/statements")
  revalidatePath("/bi")
  
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
  
  // Convert ALL Decimal fields to numbers - build new object explicitly
  return {
    id: expense.id,
    unitId: expense.unitId,
    month: expense.month,
    date: expense.date instanceof Date ? expense.date.toISOString() : (expense.date ? String(expense.date) : null),
    category: expense.category,
    description: expense.description,
    amount: decimalToNumber(expense.amount) || 0,
    currency: expense.currency,
    deductibleFlag: expense.deductibleFlag,
    paidByTenant: expense.paidByTenant ?? false,
    vendor: expense.vendor || null,
    ivaRatePercent: decimalToNumber(expense.ivaRatePercent),
    ivaAmount: decimalToNumber(expense.ivaAmount),
    igRatePercent: decimalToNumber(expense.igRatePercent),
    igAmount: decimalToNumber(expense.igAmount),
    iibbRatePercent: decimalToNumber(expense.iibbRatePercent),
    iibbAmount: decimalToNumber(expense.iibbAmount),
    totalAmount: decimalToNumber(expense.totalAmount) || 0,
    createdAt: expense.createdAt instanceof Date ? expense.createdAt.toISOString() : (expense.createdAt ? String(expense.createdAt) : null),
    updatedAt: expense.updatedAt instanceof Date ? expense.updatedAt.toISOString() : (expense.updatedAt ? String(expense.updatedAt) : null),
    // Build unit object explicitly, converting all Decimal fields
    unit: expense.unit ? {
      id: expense.unit.id,
      userId: expense.unit.userId,
      name: expense.unit.name,
      address: expense.unit.address || null,
      type: expense.unit.type,
      notes: expense.unit.notes || null,
      archived: expense.unit.archived,
      aplicaIvaAlquiler: (expense.unit as any).aplicaIvaAlquiler || false,
      ivaRatePercent: decimalToNumber((expense.unit as any).ivaRatePercent),
      igRatePercent: decimalToNumber((expense.unit as any).igRatePercent),
      iibbRatePercent: decimalToNumber((expense.unit as any).iibbRatePercent),
      monthlyExpensesAmount: decimalToNumber((expense.unit as any).monthlyExpensesAmount),
      createdAt: expense.unit.createdAt instanceof Date ? expense.unit.createdAt.toISOString() : (expense.unit.createdAt ? String(expense.unit.createdAt) : null),
      updatedAt: expense.unit.updatedAt instanceof Date ? expense.unit.updatedAt.toISOString() : (expense.unit.updatedAt ? String(expense.unit.updatedAt) : null),
    } : null,
  }
}

export async function updateExpense(
  id: string,
  data: Partial<z.infer<typeof expenseSchema>>
) {
  // Verify expense exists
  const existing = await prisma.monthlyExpense.findFirst({
    where: { id },
    include: { unit: true },
  })
  if (!existing) {
    throw new Error("Expense not found")
  }

  const updateData: any = {}
  if (data.unitId) updateData.unitId = data.unitId
  if (data.month) updateData.month = data.month
  if (data.date) {
    updateData.date = data.date instanceof Date ? data.date : new Date(data.date)
  }
  if (data.category) updateData.category = data.category
  if (data.description !== undefined) updateData.description = data.description?.trim() || null
  
  // Update amount if provided
  if (data.amount !== undefined) {
    const newAmount = typeof data.amount === "string" ? parseFloat(data.amount) : data.amount
    updateData.amount = newAmount
    // Expenses don't have taxes - total is just the amount
    updateData.totalAmount = newAmount
    updateData.ivaRatePercent = null
    updateData.ivaAmount = null
    updateData.igRatePercent = null
    updateData.igAmount = null
    updateData.iibbRatePercent = null
    updateData.iibbAmount = null
  }

  if (data.currency) updateData.currency = data.currency
  if (data.deductibleFlag !== undefined) updateData.deductibleFlag = data.deductibleFlag
  if (data.paidByTenant !== undefined) updateData.paidByTenant = data.paidByTenant
  if (data.vendor !== undefined) updateData.vendor = data.vendor

  const expense = await prisma.monthlyExpense.update({
    where: { id },
    data: updateData,
    include: {
      unit: true,
    },
  })

  revalidatePath("/expenses")
  revalidatePath("/statements")
  revalidatePath("/bi")
  
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
  
  // Convert ALL Decimal fields to numbers - build new object explicitly
  return {
    id: expense.id,
    unitId: expense.unitId,
    month: expense.month,
    date: expense.date instanceof Date ? expense.date.toISOString() : (expense.date ? String(expense.date) : null),
    category: expense.category,
    description: expense.description,
    amount: decimalToNumber(expense.amount) || 0,
    currency: expense.currency,
    deductibleFlag: expense.deductibleFlag,
    paidByTenant: expense.paidByTenant ?? false,
    vendor: expense.vendor || null,
    ivaRatePercent: decimalToNumber(expense.ivaRatePercent),
    ivaAmount: decimalToNumber(expense.ivaAmount),
    igRatePercent: decimalToNumber(expense.igRatePercent),
    igAmount: decimalToNumber(expense.igAmount),
    iibbRatePercent: decimalToNumber(expense.iibbRatePercent),
    iibbAmount: decimalToNumber(expense.iibbAmount),
    totalAmount: decimalToNumber(expense.totalAmount) || 0,
    createdAt: expense.createdAt instanceof Date ? expense.createdAt.toISOString() : (expense.createdAt ? String(expense.createdAt) : null),
    updatedAt: expense.updatedAt instanceof Date ? expense.updatedAt.toISOString() : (expense.updatedAt ? String(expense.updatedAt) : null),
    // Build unit object explicitly, converting all Decimal fields
    unit: expense.unit ? {
      id: expense.unit.id,
      userId: expense.unit.userId,
      name: expense.unit.name,
      address: expense.unit.address || null,
      type: expense.unit.type,
      notes: expense.unit.notes || null,
      archived: expense.unit.archived,
      aplicaIvaAlquiler: (expense.unit as any).aplicaIvaAlquiler || false,
      ivaRatePercent: decimalToNumber((expense.unit as any).ivaRatePercent),
      igRatePercent: decimalToNumber((expense.unit as any).igRatePercent),
      iibbRatePercent: decimalToNumber((expense.unit as any).iibbRatePercent),
      monthlyExpensesAmount: decimalToNumber((expense.unit as any).monthlyExpensesAmount),
      createdAt: expense.unit.createdAt instanceof Date ? expense.unit.createdAt.toISOString() : (expense.unit.createdAt ? String(expense.unit.createdAt) : null),
      updatedAt: expense.unit.updatedAt instanceof Date ? expense.unit.updatedAt.toISOString() : (expense.unit.updatedAt ? String(expense.unit.updatedAt) : null),
    } : null,
  }
}

export async function deleteExpense(id: string) {
  const userId = await getDefaultUserId()
  const expense = await prisma.monthlyExpense.findFirst({
    where: { id },
    include: { unit: true },
  })
  if (!expense) {
    throw new Error("Gasto no encontrado")
  }
  if (expense.unit.userId !== userId) {
    throw new Error("No tenés permiso para eliminar este gasto")
  }

  await prisma.monthlyExpense.delete({
    where: { id },
  })

  revalidatePath("/expenses")
  revalidatePath("/statements")
  revalidatePath("/bi")
}

export async function getExpenses(unitId?: string, month?: string) {
  const userId = await getDefaultUserId()
  
  const where: any = {
    unit: {
      userId,
    }
  }

  if (unitId) where.unitId = unitId
  if (month) where.month = month

  const expenses = await prisma.monthlyExpense.findMany({
    where,
    include: {
      unit: true,
    },
    orderBy: [
      { month: "desc" as const },
      { date: "desc" as const },
      { createdAt: "desc" as const },
    ],
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

  // Convert Decimal to number - build new objects explicitly
  type ExpenseInput = {
    id: string
    unitId: string
    month: string
    date?: Date | string | null
    category: string
    description: string
    amount?: unknown
    totalAmount?: unknown
    currency: string
    deductibleFlag: boolean
    paidByTenant?: boolean
    vendor?: string | null
    ivaRatePercent?: unknown
    ivaAmount?: unknown
    igRatePercent?: unknown
    igAmount?: unknown
    iibbRatePercent?: unknown
    iibbAmount?: unknown
    createdAt?: Date | string | null
    updatedAt?: Date | string | null
    unit?: {
      id: string
      userId: string
      name: string
      address?: string | null
      type: string
      notes?: string | null
      archived: boolean
      aplicaIvaAlquiler?: boolean
      ivaRatePercent?: unknown
      igRatePercent?: unknown
      iibbRatePercent?: unknown
      monthlyExpensesAmount?: unknown
      createdAt?: Date | string | null
      updatedAt?: Date | string | null
    } | null
  }
  return expenses.map((expense: ExpenseInput) => {
    // Convert all Decimal fields to numbers - ensure NO Decimal objects remain
    const amountNum = decimalToNumber(expense.amount)
    const totalAmountNum = decimalToNumber(expense.totalAmount)
    // Use totalAmount if available, otherwise use amount
    const finalTotalAmount = (totalAmountNum !== null && totalAmountNum !== undefined) ? totalAmountNum : (amountNum !== null && amountNum !== undefined ? amountNum : 0)

    // Ensure all numeric fields are converted to plain numbers (not Decimal)
    const convertedExpense = {
      id: expense.id,
      unitId: expense.unitId,
      month: expense.month,
      date: expense.date instanceof Date ? expense.date.toISOString() : (expense.date ? String(expense.date) : null),
      category: expense.category,
      description: expense.description,
      amount: amountNum !== null && amountNum !== undefined ? amountNum : 0,
      currency: expense.currency,
      deductibleFlag: expense.deductibleFlag,
      paidByTenant: (expense as any).paidByTenant ?? false,
      vendor: expense.vendor || null,
      ivaRatePercent: decimalToNumber(expense.ivaRatePercent),
      ivaAmount: decimalToNumber(expense.ivaAmount),
      igRatePercent: decimalToNumber(expense.igRatePercent),
      igAmount: decimalToNumber(expense.igAmount),
      iibbRatePercent: decimalToNumber(expense.iibbRatePercent),
      iibbAmount: decimalToNumber(expense.iibbAmount),
      totalAmount: finalTotalAmount,
      createdAt: expense.createdAt instanceof Date ? expense.createdAt.toISOString() : (expense.createdAt ? String(expense.createdAt) : null),
      updatedAt: expense.updatedAt instanceof Date ? expense.updatedAt.toISOString() : (expense.updatedAt ? String(expense.updatedAt) : null),
      // Build unit object explicitly, converting all Decimal fields
      unit: expense.unit ? {
        id: expense.unit.id,
        userId: expense.unit.userId,
        name: expense.unit.name,
        address: expense.unit.address || null,
        type: expense.unit.type,
        notes: expense.unit.notes || null,
        archived: expense.unit.archived,
        aplicaIvaAlquiler: expense.unit.aplicaIvaAlquiler ?? false,
        ivaRatePercent: decimalToNumber(expense.unit.ivaRatePercent),
        igRatePercent: decimalToNumber(expense.unit.igRatePercent),
        iibbRatePercent: decimalToNumber(expense.unit.iibbRatePercent),
        monthlyExpensesAmount: decimalToNumber(expense.unit.monthlyExpensesAmount),
        createdAt: expense.unit.createdAt instanceof Date ? expense.unit.createdAt.toISOString() : (expense.unit.createdAt ? String(expense.unit.createdAt) : null),
        updatedAt: expense.unit.updatedAt instanceof Date ? expense.unit.updatedAt.toISOString() : (expense.unit.updatedAt ? String(expense.unit.updatedAt) : null),
      } : null,
    }
    
    return convertedExpense
  })
}
