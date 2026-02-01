import { UnitsList } from "@/components/units/units-list"
import { getPropertyGroups } from "@/lib/actions/property-groups"
import { getUnits } from "@/lib/actions/units"
import type { UnitUI } from "@/lib/ui-types"
import { toUnitUI } from "@/lib/ui-mappers"

export const dynamic = "force-dynamic"

export default async function UnitsPage() {
  const units = await getUnits()
  const propertyGroups = await getPropertyGroups()

  const unitsForUI = units.map((u: unknown) => toUnitUI(u)).filter((u: UnitUI | null): u is UnitUI => u !== null)

  return <UnitsList initialUnits={unitsForUI} initialPropertyGroups={propertyGroups} />
}
