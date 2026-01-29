import { UnitsList } from "@/components/units/units-list"
import { getUnits } from "@/lib/actions/units"
import { getPropertyGroups } from "@/lib/actions/property-groups"

export default async function UnitsPage() {
  const units = await getUnits()
  const propertyGroups = await getPropertyGroups()

  return <UnitsList initialUnits={units} initialPropertyGroups={propertyGroups} />
}
