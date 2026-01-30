import { MonthlyCalendarView } from "@/components/calendar/monthly-calendar-view"
import { getUnits } from "@/lib/actions/units"
import { getRentalPeriods } from "@/lib/actions/rental-periods"

export default async function CalendarPage() {
  const units = await getUnits()
  const rentalPeriods = await getRentalPeriods()

  const rentalPeriodsForUI = rentalPeriods.map((rp) => ({
    ...rp,
    priceAmount: Number(rp.priceAmount),
  }))

  return <MonthlyCalendarView units={units} initialRentalPeriods={rentalPeriodsForUI} />
}
