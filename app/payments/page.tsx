import { PaymentsPage } from "@/components/payments/payments-page"
import { getUnits } from "@/lib/actions/units"

export default async function PaymentsPageRoute() {
  const units = await getUnits()

  return <PaymentsPage units={units} />
}
