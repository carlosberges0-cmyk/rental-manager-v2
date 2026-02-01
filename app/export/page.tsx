import { ExportPage } from "@/components/export/export-page"
import { calculateTaxes } from "@/lib/actions/taxes"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { getExpenses } from "@/lib/actions/expenses"
import { toTaxDataUI, toRentalPeriodUI, toExpenseUI } from "@/lib/ui-mappers"

export const dynamic = "force-dynamic"

export default async function ExportPageRoute() {
  const currentYear = new Date().getFullYear()
  const taxData = await calculateTaxes(currentYear)
  const rentalPeriods = await getRentalPeriods()
  const expenses = await getExpenses()

  const taxDataForUI = toTaxDataUI(taxData)
  const rentalPeriodsForUI = rentalPeriods.map((rp: unknown) => toRentalPeriodUI(rp))
  const expensesForUI = expenses.map((e: unknown) => toExpenseUI(e))

  return (
    <ExportPage
      taxData={taxDataForUI}
      rentalPeriods={rentalPeriodsForUI}
      expenses={expensesForUI}
    />
  )
}
