import { ExpensesList } from "@/components/expenses/expenses-list"
import { getExpenses } from "@/lib/actions/expenses"
import { getUnitsWithRentalPeriods, getUnits } from "@/lib/actions/units"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import type { UnitWithRentalPeriodsUI } from "@/lib/ui-types"
import { toExpenseUI, toUnitUI, toRentalPeriodUI } from "@/lib/ui-mappers"

export const dynamic = "force-dynamic"

export default async function ExpensesPage() {
  const expenses = await getExpenses()
  const unitsWithRentals = await getUnitsWithRentalPeriods()
  const allUnits = await getUnits()
  const rentalPeriods = await getRentalPeriods()

  const unitsForUI = allUnits.map((unit: unknown) => {
    const u = toUnitUI(unit)
    if (!u) return null
    const withRentals = unitsWithRentals.find((ur: { id?: string }) => ur.id === u.id)
    const rps = (withRentals as { rentalPeriods?: unknown[] })?.rentalPeriods || []
    return {
      ...u,
      rentalPeriods: rps.map((rp: unknown) => toRentalPeriodUI(rp)),
    }
  }).filter((u: UnitWithRentalPeriodsUI | null): u is UnitWithRentalPeriodsUI => u !== null)

  const expensesForUI = expenses.map((e: unknown) => toExpenseUI(e))
  const rentalPeriodsForUI = rentalPeriods.map((rp: unknown) => toRentalPeriodUI(rp))

  return <ExpensesList initialExpenses={expensesForUI} units={unitsForUI} rentalPeriods={rentalPeriodsForUI} />
}
