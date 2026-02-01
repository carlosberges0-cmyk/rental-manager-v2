import { BIPage } from "@/components/bi/bi-page"
import type { UnitUI } from "@/lib/ui-types"
import { calculateTaxes } from "@/lib/actions/taxes"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { getExpenses } from "@/lib/actions/expenses"
import { getUnits } from "@/lib/actions/units"
import { toRentalPeriodUI, toExpenseUI, toUnitUI, toTaxDataUI } from "@/lib/ui-mappers"

export const dynamic = "force-dynamic"

export default async function BIPageRoute() {
  const currentYear = new Date().getFullYear()
  const taxData = await calculateTaxes(currentYear)
  const rentalPeriods = await getRentalPeriods()
  const expenses = await getExpenses()
  const units = await getUnits()

  const taxDataForUI = toTaxDataUI(taxData)
  const rentalPeriodsForUI = rentalPeriods.map((rp: unknown) => toRentalPeriodUI(rp))
  const expensesForUI = expenses.map((e: unknown) => toExpenseUI(e))
  const unitsForUI = units.map((u: unknown) => toUnitUI(u)).filter((u: UnitUI | null): u is UnitUI => u !== null)

  return (
    <BIPage
      taxData={taxDataForUI}
      rentalPeriods={rentalPeriodsForUI}
      expenses={expensesForUI}
      units={unitsForUI}
    />
  )
}
