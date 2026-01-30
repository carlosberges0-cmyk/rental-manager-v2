"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"
import { getDefaultUserId } from "./auth-helper"

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
  
  // Get rental periods for the period
  const startDate = month 
    ? new Date(year, month - 1, 1)
    : new Date(year, 0, 1)
  const endDate = month
    ? new Date(year, month, 0, 23, 59, 59)
    : new Date(year, 11, 31, 23, 59, 59)

  const rentalPeriods = await prisma.rentalPeriod.findMany({
    where: {
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
    include: {
      unit: true,
    },
  })

  // Get expenses for the period
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

  // Calculate income (normalize to monthly amounts)
  let totalIncome = 0
  const incomeByMonth: Record<string, number> = {}

  for (const period of rentalPeriods) {
    const periodStart = new Date(Math.max(period.startDate.getTime(), startDate.getTime()))
    const periodEnd = new Date(Math.min(period.endDate.getTime(), endDate.getTime()))
    
    if (periodStart > periodEnd) continue

    const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const totalDays = Math.ceil((period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    
    // Convert priceAmount to number safely (handling Decimal)
    const priceAmount = period.priceAmount instanceof Decimal 
      ? period.priceAmount.toNumber() 
      : typeof period.priceAmount === 'number' 
        ? period.priceAmount 
        : Number(period.priceAmount) || 0
    
    let monthlyAmount = 0
    if (period.billingFrequency === "MONTHLY") {
      monthlyAmount = priceAmount
    } else if (period.billingFrequency === "WEEKLY") {
      monthlyAmount = priceAmount * 4.33
    } else if (period.billingFrequency === "DAILY") {
      monthlyAmount = priceAmount * 30
    } else if (period.billingFrequency === "ONE_TIME") {
      monthlyAmount = priceAmount / (totalDays / 30)
    }

    // Distribute across months
    const currentDate = new Date(periodStart)
    while (currentDate <= periodEnd) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`
      if (!monthFilter || monthKey === monthFilter) {
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
        const daysInThisMonth = Math.min(
          daysInMonth - currentDate.getDate() + 1,
          Math.ceil((periodEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        )
        const proportion = daysInThisMonth / daysInPeriod
        const amount = monthlyAmount * proportion
        
        incomeByMonth[monthKey] = (incomeByMonth[monthKey] || 0) + amount
        totalIncome += amount
      }
      currentDate.setMonth(currentDate.getMonth() + 1)
      currentDate.setDate(1)
    }
  }

  // Calculate expenses
  let totalExpenses = 0
  let deductibleExpenses = 0
  const expensesByMonth: Record<string, { total: number; deductible: number }> = {}

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
