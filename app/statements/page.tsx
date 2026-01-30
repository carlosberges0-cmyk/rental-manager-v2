import { StatementsPage } from "@/components/statements/statements-page"
import { getStatements } from "@/lib/actions/statements"
import { getUnits } from "@/lib/actions/units"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { getExpenses } from "@/lib/actions/expenses"
import { format } from "date-fns"
import { toUnitUI, toRentalPeriodUI, toExpenseUI } from "@/lib/ui-mappers"

export default async function StatementsRoute({
  searchParams,
}: {
  searchParams?: { period?: string; year?: string }
}) {
  const currentPeriod = searchParams?.period || format(new Date(), "yyyy-MM")
  const selectedYear = searchParams?.year 
    ? parseInt(searchParams.year)
    : parseInt(currentPeriod.split('-')[0])
  
  const statements = await getStatements(currentPeriod)
  const units = await getUnits()
  const rentalPeriods = await getRentalPeriods()
  const allExpenses = await getExpenses()
  
  const expenses = allExpenses.filter((e: { month?: string }) => {
    if (!e.month) return false
    const expenseYear = parseInt(e.month.split('-')[0])
    return expenseYear === selectedYear
  })

  const unitsForUI = units.map((u) => toUnitUI(u)).filter((u): u is NonNullable<typeof u> => u !== null)
  const rentalPeriodsForUI = rentalPeriods.map((rp) => toRentalPeriodUI(rp))
  const expensesForUI = expenses.map((e) => toExpenseUI(e))

  return (
    <StatementsPage
      initialStatements={statements}
      units={unitsForUI}
      rentalPeriods={rentalPeriodsForUI}
      expenses={expensesForUI}
      initialPeriod={currentPeriod}
    />
  )
}
