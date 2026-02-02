"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"
import { getDefaultUserId } from "./auth-helper"
import { getStatementsByYear } from "./statements"

const taxProfileSchema = z.object({
  ivaEnabled: z.boolean(),
  ivaRatePercent: z.number(),
  iibbEnabled: z.boolean(),
  iibbRatePercent: z.number(),
  igEstimatePercent: z.number(),
})

export async function getTaxProfile() {
  const userId = await getDefaultUserId()
  let profile = await prisma.taxProfile.findUnique({
    where: { userId },
  })

  if (!profile) {
    profile = await prisma.taxProfile.create({
      data: {
        userId,
        ivaEnabled: false,
        ivaRatePercent: 21,
        iibbEnabled: false,
        iibbRatePercent: 0,
        igEstimatePercent: 0,
      },
    })
  }

  return profile
}

export async function updateTaxProfile(data: z.infer<typeof taxProfileSchema>) {
  const validated = taxProfileSchema.parse(data)
  const userId = await getDefaultUserId()
  
  const profile = await prisma.taxProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...validated,
    },
    update: validated,
  })

  revalidatePath("/settings")
  return profile
}

export async function calculateTaxes(year: number, month?: number) {
  const profile = await getTaxProfile()
  
  const monthFilter = month ? `${year}-${String(month).padStart(2, "0")}` : undefined

  const expenses = await prisma.monthlyExpense.findMany({
    where: {
      month: monthFilter ? { startsWith: `${year}-` } : { startsWith: `${year}-` },
    },
    include: {
      unit: true,
    },
  })

  // Get all units to include their monthly expenses
  const allUnits = await prisma.unit.findMany({
    where: { archived: false },
  })

  // Ingresos = alquiler desde liquidaciones (statements)
  let totalIncome = 0
  const incomeByMonth: Record<string, number> = {}
  const statements = await getStatementsByYear(year)
  for (const stmt of statements) {
    const monthKey = stmt.period
    if (!monthKey?.startsWith(`${year}-`)) continue
    if (monthFilter && monthKey !== monthFilter) continue
    const alq = stmt.alquiler != null ? Number(stmt.alquiler) : 0
    incomeByMonth[monthKey] = (incomeByMonth[monthKey] || 0) + alq
    totalIncome += alq
  }

  // Calculate expenses: expensas (liquidaciones) + gastos manuales + unitMonthlyExpenses
  let totalExpenses = 0
  let deductibleExpenses = 0
  const expensesByMonth: Record<string, { total: number; deductible: number }> = {}

  // Expensas = gastos del edificio desde liquidaciones (statements)
  for (const stmt of statements) {
    const monthKey = stmt.period
    if (!monthKey?.startsWith(`${year}-`)) continue
    if (monthFilter && monthKey !== monthFilter) continue
    const exp = stmt.expensas != null ? Number(stmt.expensas) : 0
    if (exp > 0) {
      totalExpenses += exp
      if (!expensesByMonth[monthKey]) expensesByMonth[monthKey] = { total: 0, deductible: 0 }
      expensesByMonth[monthKey].total += exp
    }
  }

  for (const expense of expenses) {
    // Convert amount to number safely (handling Decimal)
    const amount = expense.amount instanceof Decimal 
      ? expense.amount.toNumber() 
      : typeof expense.amount === 'number' 
        ? expense.amount 
        : Number(expense.amount) || 0
    
    totalExpenses += amount
    if (expense.deductibleFlag) {
      deductibleExpenses += amount
    }

    if (!expensesByMonth[expense.month]) {
      expensesByMonth[expense.month] = { total: 0, deductible: 0 }
    }
    expensesByMonth[expense.month].total += amount
    if (expense.deductibleFlag) {
      expensesByMonth[expense.month].deductible += amount
    }
  }

  // Add unit's monthly expenses
  // Use only the monthly amount (not multiplied by 12) to match balance calculation
  // For monthly breakdown: add monthly amount to each month
  for (const unit of allUnits) {
    const monthlyExpensesAmount = unit.monthlyExpensesAmount instanceof Decimal 
      ? unit.monthlyExpensesAmount.toNumber() 
      : typeof unit.monthlyExpensesAmount === 'number' 
        ? unit.monthlyExpensesAmount 
        : Number(unit.monthlyExpensesAmount) || 0
    
    if (monthlyExpensesAmount > 0) {
      // Add only the monthly amount to total expenses (NOT multiplied by 12) to match balance
      totalExpenses += monthlyExpensesAmount
      
      // Distribute monthly expenses across all months (one time per month for monthly breakdown)
      for (let m = 1; m <= 12; m++) {
        const monthKey = `${year}-${String(m).padStart(2, "0")}`
        if (!monthFilter || monthKey === monthFilter) {
          if (!expensesByMonth[monthKey]) {
            expensesByMonth[monthKey] = { total: 0, deductible: 0 }
          }
          // Add monthly amount to each month's expenses for monthly breakdown
          expensesByMonth[monthKey].total += monthlyExpensesAmount
        }
      }
    }
  }

  const netResult = totalIncome - totalExpenses

  // Calculate taxes
  const taxableIncome = totalIncome // For MVP, assume all income is taxable unless exempt
  const ivaAmount = profile.ivaEnabled
    ? (taxableIncome * Number(profile.ivaRatePercent)) / 100
    : 0
  const iibbAmount = profile.iibbEnabled
    ? (totalIncome * Number(profile.iibbRatePercent)) / 100
    : 0
  const igEstimate = Number(profile.igEstimatePercent) > 0
    ? (netResult * Number(profile.igEstimatePercent)) / 100
    : 0

  // Ensure all values are numbers, not Decimal
  return {
    income: Number(totalIncome),
    expenses: Number(totalExpenses),
    deductibleExpenses: Number(deductibleExpenses),
    netResult: Number(netResult),
    ivaAmount: Number(ivaAmount),
    iibbAmount: Number(iibbAmount),
    igEstimate: Number(igEstimate),
    incomeByMonth: Object.fromEntries(
      Object.entries(incomeByMonth).map(([key, value]) => [key, Number(value)])
    ),
    expensesByMonth: Object.fromEntries(
      Object.entries(expensesByMonth).map(([key, value]) => [
        key,
        {
          total: Number(value.total),
          deductible: Number(value.deductible),
        },
      ])
    ),
  }
}
