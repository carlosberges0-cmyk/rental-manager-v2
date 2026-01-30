import { SettingsPage } from "@/components/settings/settings-page"
import { getTaxProfile } from "@/lib/actions/taxes"

export const dynamic = "force-dynamic"

export default async function SettingsPageRoute() {
  const taxProfile = await getTaxProfile()

  return <SettingsPage initialTaxProfile={taxProfile} />
}
