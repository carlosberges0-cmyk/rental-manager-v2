import { UnitsList } from "@/components/units/units-list"
import { getPropertyGroups } from "@/lib/actions/property-groups"
import { getUnits } from "@/lib/actions/units"
import { toUnitUI } from "@/lib/ui-mappers"

export const dynamic = "force-dynamic"

export default async function UnitsPage() {
  const units = await getUnits()
  const propertyGroups = await getPropertyGroups()

  const unitsForUI = units.map((u) => toUnitUI(u)).filter((u): u is NonNullable<typeof u> => u !== null)

  return <UnitsList initialUnits={unitsForUI} initialPropertyGroups={propertyGroups} />
}
