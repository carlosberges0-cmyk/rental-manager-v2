import { ExpensesList } from "@/components/expenses/expenses-list"
import { getExpenses } from "@/lib/actions/expenses"
import { getUnitsWithRentalPeriods, getUnits } from "@/lib/actions/units"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { toExpenseUI, toUnitUI, toRentalPeriodUI } from "@/lib/ui-mappers"

export default async function ExpensesPage() {
  const expenses = await getExpenses()
  const unitsWithRentals = await getUnitsWithRentalPeriods()
  const allUnits = await getUnits()
  const rentalPeriods = await getRentalPeriods()

  const unitsForUI = allUnits.map((unit) => {
    const u = toUnitUI(unit)
    if (!u) return null
    const withRentals = unitsWithRentals.find((ur) => (ur as { id?: string }).id === u.id)
    const rps = (withRentals as { rentalPeriods?: unknown[] })?.rentalPeriods || []
    return {
      ...u,
      rentalPeriods: rps.map((rp) => toRentalPeriodUI(rp)),
    }
  }).filter((u): u is NonNullable<typeof u> => u !== null)

  const expensesForUI = expenses.map((e) => toExpenseUI(e))
  const rentalPeriodsForUI = rentalPeriods.map((rp) => toRentalPeriodUI(rp))

  return <ExpensesList initialExpenses={expensesForUI} units={unitsForUI} rentalPeriods={rentalPeriodsForUI} />
}
