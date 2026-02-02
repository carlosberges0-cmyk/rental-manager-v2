import { BIPage } from "@/components/bi/bi-page"
import type { UnitUI } from "@/lib/ui-types"
import { calculateTaxes } from "@/lib/actions/taxes"
import { getStatementsByYear } from "@/lib/actions/statements"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { getExpenses } from "@/lib/actions/expenses"
import { getUnits } from "@/lib/actions/units"
import { toRentalPeriodUI, toExpenseUI, toUnitUI, toTaxDataUI } from "@/lib/ui-mappers"

export const dynamic = "force-dynamic"

export default async function BIPageRoute() {
  const currentYear = new Date().getFullYear()
  const [taxData, statementsCurrent, statementsPrev1, statementsPrev2, rentalPeriods, expenses, units] = await Promise.all([
    calculateTaxes(currentYear),
    getStatementsByYear(currentYear),
    getStatementsByYear(currentYear - 1),
    getStatementsByYear(currentYear - 2),
    getRentalPeriods(),
    getExpenses(),
    getUnits(),
  ])
  const statementsByYear: Record<number, typeof statementsCurrent> = {
    [currentYear]: statementsCurrent,
    [currentYear - 1]: statementsPrev1,
    [currentYear - 2]: statementsPrev2,
  }

  const taxDataForUI = toTaxDataUI(taxData)
  const rentalPeriodsForUI = rentalPeriods.map((rp: unknown) => toRentalPeriodUI(rp))
  const expensesForUI = expenses.map((e: unknown) => toExpenseUI(e))
  const unitsForUI = units.map((u: unknown) => toUnitUI(u)).filter((u: UnitUI | null): u is UnitUI => u !== null)

  return (
    <BIPage
      taxData={taxDataForUI}
      statementsByYear={statementsByYear}
      rentalPeriods={rentalPeriodsForUI}
      expenses={expensesForUI}
      units={unitsForUI}
    />
  )
}
