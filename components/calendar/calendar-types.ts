/** UI type for calendar rental periods: priceAmount is number (not Prisma Decimal). Dates as ISO strings or Date. */
export type RentalPeriodUI = {
  id: string
  unitId: string
  tenantId: string | null
  startDate: string | Date
  endDate: string | Date
  priceAmount: number
  currency: string
  billingFrequency: string
  status: string
  notes: string | null
  exemptFromIVA: boolean
  unit: { id: string; name: string; type: string } | null
  tenant: { name: string } | null
}
