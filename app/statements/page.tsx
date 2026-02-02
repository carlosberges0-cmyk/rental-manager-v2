import { StatementsPage } from "@/components/statements/statements-page"
import { getStatements } from "@/lib/actions/statements"
import { getUnits } from "@/lib/actions/units"
import { getPropertyGroups } from "@/lib/actions/property-groups"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { getExpenses } from "@/lib/actions/expenses"
import { format } from "date-fns"
import type { UnitUI } from "@/lib/ui-types"
import { toUnitUI, toRentalPeriodUI, toExpenseUI } from "@/lib/ui-mappers"

export const dynamic = "force-dynamic"

export default async function StatementsRoute({
  searchParams,
}: {
  searchParams?: { period?: string; year?: string }
}) {
  const currentPeriod = searchParams?.period || format(new Date(), "yyyy-MM")
  const selectedYear = searchParams?.year 
    ? parseInt(searchParams.year)
    : parseInt(currentPeriod.split('-')[0])
  
  const [statements, units, propertyGroups, rentalPeriods, allExpenses] = await Promise.all([
    getStatements(currentPeriod),
    getUnits(),
    getPropertyGroups(),
    getRentalPeriods(),
    getExpenses(),
  ])
  
  const expenses = allExpenses.filter((e: { month?: string }) => {
    if (!e.month) return false
    const expenseYear = parseInt(e.month.split('-')[0])
    return expenseYear === selectedYear
  })

  const unitsForUI = units.map((u: unknown) => toUnitUI(u)).filter((u: UnitUI | null): u is UnitUI => u !== null)
  const rentalPeriodsForUI = rentalPeriods.map((rp: unknown) => toRentalPeriodUI(rp))
  const expensesForUI = expenses.map((e: unknown) => toExpenseUI(e))

  const propertyGroupsMap: Map<string, string> = new Map(
    (propertyGroups || []).map((g: { id: string; name: string }) => [g.id, g.name] as [string, string])
  )

  return (
    <StatementsPage
      initialStatements={statements}
      units={unitsForUI}
      propertyGroupsMap={propertyGroupsMap}
      rentalPeriods={rentalPeriodsForUI}
      expenses={expensesForUI}
      initialPeriod={currentPeriod}
    />
  )
}
