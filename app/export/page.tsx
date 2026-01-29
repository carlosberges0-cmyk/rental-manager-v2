import { ExportPage } from "@/components/export/export-page"
import { calculateTaxes } from "@/lib/actions/taxes"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { getExpenses } from "@/lib/actions/expenses"

export default async function ExportPageRoute() {
  const currentYear = new Date().getFullYear()
  const taxData = await calculateTaxes(currentYear)
  const rentalPeriods = await getRentalPeriods()
  const expenses = await getExpenses()

  return (
    <ExportPage
      taxData={taxData}
      rentalPeriods={rentalPeriods}
      expenses={expenses}
    />
  )
}
