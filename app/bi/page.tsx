import { BIPage } from "@/components/bi/bi-page"
import { calculateTaxes } from "@/lib/actions/taxes"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { getExpenses } from "@/lib/actions/expenses"
import { getUnits } from "@/lib/actions/units"

export default async function BIPageRoute() {
  const currentYear = new Date().getFullYear()
  const taxData = await calculateTaxes(currentYear)
  const rentalPeriods = await getRentalPeriods()
  const expenses = await getExpenses()
  const units = await getUnits()

  return (
    <BIPage
      taxData={taxData}
      rentalPeriods={rentalPeriods}
      expenses={expenses}
      units={units}
    />
  )
}
