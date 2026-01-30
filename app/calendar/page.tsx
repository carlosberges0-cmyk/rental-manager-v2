import { MonthlyCalendarView } from "@/components/calendar/monthly-calendar-view"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { getUnits } from "@/lib/actions/units"
import { toRentalPeriodUI, toUnitUI } from "@/lib/ui-mappers"

export const dynamic = "force-dynamic"

export default async function CalendarPage() {
  const units = await getUnits()
  const rentalPeriods = await getRentalPeriods()

  const unitsForUI = units.map((u) => toUnitUI(u)).filter((u): u is NonNullable<typeof u> => u !== null)
  const rentalPeriodsForUI = rentalPeriods.map((rp) => toRentalPeriodUI(rp))

  return <MonthlyCalendarView units={unitsForUI} initialRentalPeriods={rentalPeriodsForUI} />
}
