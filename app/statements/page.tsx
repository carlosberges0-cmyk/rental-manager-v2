import { StatementsPage } from "@/components/statements/statements-page"
import { getStatements } from "@/lib/actions/statements"
import { getUnits } from "@/lib/actions/units"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { getExpenses } from "@/lib/actions/expenses"
import { format } from "date-fns"

export default async function StatementsRoute({
  searchParams,
}: {
  searchParams?: { period?: string; year?: string }
}) {
  // Obtener el período desde los searchParams o usar el mes actual
  const currentPeriod = searchParams?.period || format(new Date(), "yyyy-MM")
  
  // Obtener el año desde los searchParams o del período
  const selectedYear = searchParams?.year 
    ? parseInt(searchParams.year)
    : parseInt(currentPeriod.split('-')[0])
  
  const statements = await getStatements(currentPeriod)
  const units = await getUnits()
  const rentalPeriods = await getRentalPeriods()
  
  // Cargar todos los gastos del año seleccionado (para la tabla anual)
  const allExpenses = await getExpenses()
  const expenses = allExpenses.filter((e: any) => {
    if (!e.month) return false
    const expenseYear = parseInt(e.month.split('-')[0])
    return expenseYear === selectedYear
  })

  return (
    <StatementsPage
      initialStatements={statements}
      units={units}
      rentalPeriods={rentalPeriods}
      expenses={expenses}
      initialPeriod={currentPeriod}
    />
  )
}
