import { SettingsPage } from "@/components/settings/settings-page"
import { getTaxProfile } from "@/lib/actions/taxes"

export const dynamic = "force-dynamic"

export default async function SettingsPageRoute() {
  const taxProfile = await getTaxProfile()
  const taxProfileForUI = taxProfile
    ? {
        id: taxProfile.id,
        userId: taxProfile.userId,
        ivaEnabled: taxProfile.ivaEnabled,
        ivaRatePercent: Number(taxProfile.ivaRatePercent),
        iibbEnabled: taxProfile.iibbEnabled,
        iibbRatePercent: Number(taxProfile.iibbRatePercent),
        igEstimatePercent: Number(taxProfile.igEstimatePercent),
      }
    : null

  if (!taxProfileForUI) return null

  return <SettingsPage initialTaxProfile={taxProfileForUI} />
}
