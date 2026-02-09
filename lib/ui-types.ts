/**
 * UI-safe types for client components.
 * All Decimal -> number, Date -> ISO string.
 * No Prisma types.
 */

export type PropertyGroupUI = {
  id: string
  name: string
}

export type UnitUI = {
  id: string
  userId: string
  name: string
  address: string | null
  type: string
  owner: string | null
  propertyGroupId: string | null
  propertyGroup: PropertyGroupUI | null
  notes: string | null
  archived: boolean
  ivaRatePercent: number | null
  igRatePercent: number | null
  iibbRatePercent: number | null
  monthlyExpensesAmount: number | null
  metrosCuadrados: number | null
  createdAt: string | null
  updatedAt: string | null
}

export type RentalPeriodUI = {
  id: string
  unitId: string
  tenantId: string | null
  startDate: string
  endDate: string
  priceAmount: number
  currency: string
  billingFrequency: string
  status: string
  notes: string | null
  exemptFromIVA: boolean
  createdAt: string | null
  updatedAt: string | null
  unit: UnitUI | null
  tenant: { id?: string; name: string } | null
}

export type ExpenseUI = {
  id: string
  unitId: string
  month: string
  date: string | null
  category: string
  description: string
  amount: number
  currency: string
  deductibleFlag: boolean
  vendor: string | null
  ivaRatePercent: number | null
  ivaAmount: number | null
  igRatePercent: number | null
  igAmount: number | null
  iibbRatePercent: number | null
  iibbAmount: number | null
  totalAmount: number
  createdAt: string | null
  updatedAt: string | null
  unit: UnitUI | null
}

export type TaxDataUI = {
  income: number
  expenses: number
  deductibleExpenses: number
  netResult: number
  ivaAmount: number
  iibbAmount: number
  igEstimate: number
  incomeByMonth: Record<string, number>
  expensesByMonth: Record<string, { total: number; deductible: number }>
}

/** Minimal unit for dropdowns/lists */
export type UnitUIMinimal = {
  id: string
  name: string
  type: string
}

/** Unit with nested rental periods (e.g. for ExpensesList) */
export type UnitWithRentalPeriodsUI = UnitUI & {
  rentalPeriods: RentalPeriodUI[]
}

/** Tax profile for settings (Decimal -> number) */
export type TaxProfileUI = {
  id: string
  userId: string
  ivaEnabled: boolean
  ivaRatePercent: number
  iibbEnabled: boolean
  iibbRatePercent: number
  igEstimatePercent: number
}
