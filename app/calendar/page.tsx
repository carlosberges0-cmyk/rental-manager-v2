import { MonthlyCalendarView } from "@/components/calendar/monthly-calendar-view"
import { getUnits } from "@/lib/actions/units"
import { getRentalPeriods } from "@/lib/actions/rental-periods"

export default async function CalendarPage() {
  const units = await getUnits()
  const rentalPeriods = await getRentalPeriods()

  const rentalPeriodsForUI = rentalPeriods.map((rp) => ({
    ...rp,
    priceAmount: Number(rp.priceAmount),
    startDate: rp.startDate instanceof Date ? rp.startDate.toISOString() : typeof rp.startDate === "string" ? rp.startDate : "",
    endDate: rp.endDate instanceof Date ? rp.endDate.toISOString() : typeof rp.endDate === "string" ? rp.endDate : "",
  }))

  return <MonthlyCalendarView units={units} initialRentalPeriods={rentalPeriodsForUI} />
}
