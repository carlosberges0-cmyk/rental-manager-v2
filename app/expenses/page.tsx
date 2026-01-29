import { ExpensesList } from "@/components/expenses/expenses-list"
import { getExpenses } from "@/lib/actions/expenses"
import { getUnitsWithRentalPeriods, getUnits } from "@/lib/actions/units"
import { getRentalPeriods } from "@/lib/actions/rental-periods"

export default async function ExpensesPage() {
  const expenses = await getExpenses()
  const unitsWithRentals = await getUnitsWithRentalPeriods()
  const allUnits = await getUnits()
  const rentalPeriods = await getRentalPeriods()

  // Merge units to get all units with their tax rates
  const units = allUnits.map(unit => {
    const withRentals = unitsWithRentals.find(u => u.id === unit.id)
    return {
      ...unit,
      rentalPeriods: withRentals?.rentalPeriods || [],
    }
  })

  return <ExpensesList initialExpenses={expenses} units={units} rentalPeriods={rentalPeriods} />
}
