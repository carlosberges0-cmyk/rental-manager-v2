import { MonthlyCalendarView } from "@/components/calendar/monthly-calendar-view"
import { getPropertyGroups } from "@/lib/actions/property-groups"
import { getRentalPeriods } from "@/lib/actions/rental-periods"
import { getUnits } from "@/lib/actions/units"
import type { UnitUI } from "@/lib/ui-types"
import { toRentalPeriodUI, toUnitUI } from "@/lib/ui-mappers"

export const dynamic = "force-dynamic"

export default async function CalendarPage() {
  const [units, rentalPeriods, propertyGroups] = await Promise.all([
    getUnits(),
    getRentalPeriods(),
    getPropertyGroups(),
  ])

  const unitsForUI = units.map((u: unknown) => toUnitUI(u)).filter((u: UnitUI | null): u is UnitUI => u !== null)
  const rentalPeriodsForUI = rentalPeriods.map((rp: unknown) => toRentalPeriodUI(rp))
  const propertyGroupsForUI = (propertyGroups || []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name }))

  return (
    <MonthlyCalendarView
      units={unitsForUI}
      initialRentalPeriods={rentalPeriodsForUI}
      propertyGroups={propertyGroupsForUI}
    />
  )
}
