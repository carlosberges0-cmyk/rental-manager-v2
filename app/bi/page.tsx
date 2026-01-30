import { BIPage } from "@/components/bi/bi-page"
import { calculateTaxes } from "@/lib/actions/taxes"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { getExpenses } from "@/lib/actions/expenses"
import { getUnits } from "@/lib/actions/units"

function toISO(v: Date | string | null | undefined): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === "string") return v
  return null
}

export default async function BIPageRoute() {
  const currentYear = new Date().getFullYear()
  const taxData = await calculateTaxes(currentYear)
  const rentalPeriods = await getRentalPeriods()
  const expenses = await getExpenses()
  const units = await getUnits()

  const rentalPeriodsForUI = rentalPeriods.map((rp) => {
    const startDate = rp.startDate instanceof Date ? rp.startDate.toISOString() : typeof rp.startDate === "string" ? rp.startDate : ""
    const endDate = rp.endDate instanceof Date ? rp.endDate.toISOString() : typeof rp.endDate === "string" ? rp.endDate : ""
    return {
      ...rp,
      priceAmount: Number(rp.priceAmount),
      startDate,
      endDate,
      createdAt: toISO((rp as { createdAt?: Date }).createdAt),
      updatedAt: toISO((rp as { updatedAt?: Date }).updatedAt),
      unit: rp.unit
        ? {
            ...rp.unit,
            ivaRatePercent: rp.unit.ivaRatePercent != null ? Number(rp.unit.ivaRatePercent) : null,
            igRatePercent: rp.unit.igRatePercent != null ? Number(rp.unit.igRatePercent) : null,
            iibbRatePercent: rp.unit.iibbRatePercent != null ? Number(rp.unit.iibbRatePercent) : null,
            monthlyExpensesAmount: rp.unit.monthlyExpensesAmount != null ? Number(rp.unit.monthlyExpensesAmount) : null,
            createdAt: toISO((rp.unit as { createdAt?: Date }).createdAt),
            updatedAt: toISO((rp.unit as { updatedAt?: Date }).updatedAt),
          }
        : null,
      tenant: rp.tenant
        ? {
            ...rp.tenant,
            createdAt: toISO((rp.tenant as { createdAt?: Date }).createdAt),
            updatedAt: toISO((rp.tenant as { updatedAt?: Date }).updatedAt),
          }
        : null,
    }
  })

  const expensesForUI = expenses.map((e) => ({
    ...e,
    amount: Number(e.amount),
    totalAmount: Number(e.totalAmount),
  }))

  const unitsForUI = units.map((u) => {
    const ua = u as { ivaRatePercent?: unknown; igRatePercent?: unknown; iibbRatePercent?: unknown; monthlyExpensesAmount?: unknown; createdAt?: Date; updatedAt?: Date }
    return {
      ...u,
      ivaRatePercent: ua.ivaRatePercent != null ? Number(ua.ivaRatePercent) : null,
      igRatePercent: ua.igRatePercent != null ? Number(ua.igRatePercent) : null,
      iibbRatePercent: ua.iibbRatePercent != null ? Number(ua.iibbRatePercent) : null,
      monthlyExpensesAmount: ua.monthlyExpensesAmount != null ? Number(ua.monthlyExpensesAmount) : null,
      createdAt: toISO(ua.createdAt),
      updatedAt: toISO(ua.updatedAt),
    }
  })

  return (
    <BIPage
      taxData={taxData}
      rentalPeriods={rentalPeriodsForUI}
      expenses={expensesForUI}
      units={unitsForUI}
    />
  )
}
