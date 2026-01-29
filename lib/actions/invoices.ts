"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getInvoiceProvider, InvoicePayload } from "@/lib/invoicing/provider"
import { z } from "zod"
import { getDefaultUserId } from "./auth-helper"

const invoiceSchema = z.object({
  unitId: z.string(),
  rentalPeriodId: z.string().optional(),
  issueDate: z.string().or(z.date()),
  concept: z.string().min(1),
  netAmount: z.number().or(z.string()),
  ivaAmount: z.number().or(z.string()),
  totalAmount: z.number().or(z.string()),
  currency: z.enum(["ARS", "USD"]),
})

export async function createInvoice(data: z.infer<typeof invoiceSchema>) {
  // Verify unit exists
  const unit = await prisma.unit.findFirst({
    where: { id: data.unitId },
  })
  if (!unit) throw new Error("Unit not found")

  const validated = invoiceSchema.parse(data)
  const issueDate = validated.issueDate instanceof Date 
    ? validated.issueDate 
    : new Date(validated.issueDate)

  // Create invoice payload
  const payload: InvoicePayload = {
    unitId: validated.unitId,
    rentalPeriodId: validated.rentalPeriodId,
    issueDate,
    concept: validated.concept,
    netAmount: typeof validated.netAmount === "string"
      ? parseFloat(validated.netAmount)
      : validated.netAmount,
    ivaAmount: typeof validated.ivaAmount === "string"
      ? parseFloat(validated.ivaAmount)
      : validated.ivaAmount,
    totalAmount: typeof validated.totalAmount === "string"
      ? parseFloat(validated.totalAmount)
      : validated.totalAmount,
    currency: validated.currency,
  }

  // Call invoice provider
  const provider = getInvoiceProvider()
  const response = await provider.createInvoice(payload)

  // Save invoice to database
  const userId = await getDefaultUserId()
  const invoice = await prisma.invoice.create({
    data: {
      userId,
      unitId: validated.unitId,
      rentalPeriodId: validated.rentalPeriodId,
      issueDate,
      concept: validated.concept,
      netAmount: payload.netAmount,
      ivaAmount: payload.ivaAmount,
      totalAmount: payload.totalAmount,
      currency: validated.currency,
      status: "ISSUED",
      externalId: response.externalId,
      cae: response.cae,
      caeDueDate: response.caeDueDate,
    },
    include: {
      unit: true,
      rentalPeriod: true,
    },
  })

  return invoice
}

export async function getInvoices(unitId?: string) {
  const userId = await getDefaultUserId()
  
  const where: any = {
    userId,
  }

  if (unitId) where.unitId = unitId

  return prisma.invoice.findMany({
    where,
    include: {
      unit: true,
      rentalPeriod: true,
    },
    orderBy: { issueDate: "desc" },
  })
}

export async function getInvoice(id: string) {
  const userId = await getDefaultUserId()
  
  return prisma.invoice.findFirst({
    where: { 
      id,
      userId,
    },
    include: {
      unit: true,
      rentalPeriod: true,
    },
  })
}
