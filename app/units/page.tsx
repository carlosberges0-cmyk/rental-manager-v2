import { UnitsList } from "@/components/units/units-list"
import { getUnits } from "@/lib/actions/units"
import { getPropertyGroups } from "@/lib/actions/property-groups"
import { toUnitUI } from "@/lib/ui-mappers"

export default async function UnitsPage() {
  const units = await getUnits()
  const propertyGroups = await getPropertyGroups()

  const unitsForUI = units.map((u) => toUnitUI(u)).filter((u): u is NonNullable<typeof u> => u !== null)

  return <UnitsList initialUnits={unitsForUI} initialPropertyGroups={propertyGroups} />
}
