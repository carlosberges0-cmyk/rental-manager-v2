import { PaymentsPage } from "@/components/payments/payments-page"
import { getUnits } from "@/lib/actions/units"
import type { UnitUI } from "@/lib/ui-types"
import { toUnitUI } from "@/lib/ui-mappers"

export const dynamic = "force-dynamic"

export default async function PaymentsPageRoute() {
  const units = await getUnits()
  const unitsForUI = units.map((u: unknown) => toUnitUI(u)).filter((u: UnitUI | null): u is UnitUI => u !== null)

  return <PaymentsPage units={unitsForUI} />
}
