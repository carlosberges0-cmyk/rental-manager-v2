/**
 * Pure mappers: Prisma/action results -> UI-safe objects.
 * Decimal -> number, Date -> ISO string.
 */

import type { UnitUI, RentalPeriodUI, ExpenseUI, TaxDataUI } from "./ui-types"

function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number") return isNaN(v) ? null : v
  if (typeof v === "object" && v !== null && typeof (v as { toNumber?: () => number }).toNumber === "function") {
    try {
      const n = (v as { toNumber: () => number }).toNumber()
      return typeof n === "number" && !isNaN(n) ? n : null
    } catch {
      return null
    }
  }
  if (typeof v === "string") {
    const p = parseFloat(v)
    return isNaN(p) ? null : p
  }
  return null
}

function toISO(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === "string") return v
  return null
}

function toStr(v: unknown): string {
  if (v == null) return ""
  return String(v)
}

function toPropertyGroupUI(pg: unknown): { id: string; name: string } | null {
  if (!pg || typeof pg !== "object") return null
  const p = pg as Record<string, unknown>
  const id = toStr(p.id)
  const name = toStr(p.name)
  return id || name ? { id, name } : null
}

export function toUnitUI(u: unknown): UnitUI | null {
  if (!u || typeof u !== "object") return null
  const ui = u as Record<string, unknown>
  const propertyGroup = ui.propertyGroup != null ? toPropertyGroupUI(ui.propertyGroup) : null
  return {
    id: toStr(ui.id),
    userId: toStr(ui.userId),
    name: toStr(ui.name),
    address: ui.address != null ? toStr(ui.address) : null,
    type: toStr(ui.type),
    owner: ui.owner != null ? toStr(ui.owner) : null,
    propertyGroupId: ui.propertyGroupId != null ? toStr(ui.propertyGroupId) : null,
    propertyGroup,
    notes: ui.notes != null ? toStr(ui.notes) : null,
    archived: Boolean(ui.archived),
    ivaRatePercent: toNum(ui.ivaRatePercent),
    igRatePercent: toNum(ui.igRatePercent),
    iibbRatePercent: toNum(ui.iibbRatePercent),
    monthlyExpensesAmount: toNum(ui.monthlyExpensesAmount),
    createdAt: ui.createdAt != null ? (ui.createdAt instanceof Date ? ui.createdAt.toISOString() : toStr(ui.createdAt)) : null,
    updatedAt: ui.updatedAt != null ? (ui.updatedAt instanceof Date ? ui.updatedAt.toISOString() : toStr(ui.updatedAt)) : null,
  }
}

export function toRentalPeriodUI(rp: unknown): RentalPeriodUI {
  if (!rp || typeof rp !== "object") throw new Error("toRentalPeriodUI requires an object")
  const r = rp as Record<string, unknown>
  const unit = r.unit != null && typeof r.unit === "object" ? toUnitUI(r.unit as Record<string, unknown>) : null
  const tenant = r.tenant != null && typeof r.tenant === "object"
    ? { id: toStr((r.tenant as Record<string, unknown>).id) || undefined, name: toStr((r.tenant as Record<string, unknown>).name) }
    : null
  const startDate = r.startDate instanceof Date ? r.startDate.toISOString() : toStr(r.startDate) || ""
  const endDate = r.endDate instanceof Date ? r.endDate.toISOString() : toStr(r.endDate) || ""
  return {
    id: toStr(r.id),
    unitId: toStr(r.unitId),
    tenantId: r.tenantId != null ? toStr(r.tenantId) : null,
    startDate,
    endDate,
    priceAmount: toNum(r.priceAmount) ?? 0,
    currency: toStr(r.currency),
    billingFrequency: toStr(r.billingFrequency),
    status: toStr(r.status),
    notes: r.notes != null ? toStr(r.notes) : null,
    exemptFromIVA: Boolean(r.exemptFromIVA),
    createdAt: toISO(r.createdAt),
    updatedAt: toISO(r.updatedAt),
    unit: unit,
    tenant: tenant ? { id: tenant.id || "", name: tenant.name } : null,
  }
}

export function toExpenseUI(e: unknown): ExpenseUI {
  if (!e || typeof e !== "object") throw new Error("toExpenseUI requires an object")
  const r = e as Record<string, unknown>
  const amountNum = toNum(r.amount)
  const totalNum = toNum(r.totalAmount)
  const unit = r.unit != null && typeof r.unit === "object" ? toUnitUI(r.unit as Record<string, unknown>) : null
  const dateVal = r.date
  const dateStr = dateVal instanceof Date ? dateVal.toISOString() : dateVal != null ? toStr(dateVal) : null
  return {
    id: toStr(r.id),
    unitId: toStr(r.unitId),
    month: toStr(r.month),
    date: dateStr,
    category: toStr(r.category),
    description: toStr(r.description),
    amount: amountNum ?? 0,
    currency: toStr(r.currency),
    deductibleFlag: Boolean(r.deductibleFlag),
    vendor: r.vendor != null ? toStr(r.vendor) : null,
    ivaRatePercent: toNum(r.ivaRatePercent),
    ivaAmount: toNum(r.ivaAmount),
    igRatePercent: toNum(r.igRatePercent),
    igAmount: toNum(r.igAmount),
    iibbRatePercent: toNum(r.iibbRatePercent),
    iibbAmount: toNum(r.iibbAmount),
    totalAmount: totalNum ?? amountNum ?? 0,
    createdAt: toISO(r.createdAt),
    updatedAt: toISO(r.updatedAt),
    unit: unit,
  }
}

export function toTaxDataUI(t: unknown): TaxDataUI {
  if (!t || typeof t !== "object") return { income: 0, expenses: 0, deductibleExpenses: 0, netResult: 0, ivaAmount: 0, iibbAmount: 0, igEstimate: 0, incomeByMonth: {}, expensesByMonth: {} }
  const r = t as Record<string, unknown>
  return {
    income: toNum(r.income) ?? 0,
    expenses: toNum(r.expenses) ?? 0,
    deductibleExpenses: toNum(r.deductibleExpenses) ?? 0,
    netResult: toNum(r.netResult) ?? 0,
    ivaAmount: toNum(r.ivaAmount) ?? 0,
    iibbAmount: toNum(r.iibbAmount) ?? 0,
    igEstimate: toNum(r.igEstimate) ?? 0,
    incomeByMonth: (typeof r.incomeByMonth === "object" && r.incomeByMonth !== null)
      ? Object.fromEntries(
          Object.entries(r.incomeByMonth as Record<string, unknown>).map(([k, v]) => [k, toNum(v) ?? 0])
        )
      : {},
    expensesByMonth: (typeof r.expensesByMonth === "object" && r.expensesByMonth !== null)
      ? Object.fromEntries(
          Object.entries(r.expensesByMonth as Record<string, Record<string, number>>).map(([k, v]) => [
            k,
            {
              total: toNum(v?.total) ?? 0,
              deductible: toNum(v?.deductible) ?? 0,
            },
          ])
        )
      : {},
  }
}
