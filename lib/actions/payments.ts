"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"
import { getDefaultUserId } from "./auth-helper"
import { upsertStatement } from "./statements"
import { computeStatement } from "@/lib/services/statement-calculator"

const paymentSchema = z.object({
  unitId: z.string(),
  rentalPeriodId: z.string().optional(),
  amount: z.number().or(z.string()),
  currency: z.enum(["ARS", "USD"]),
  paymentDate: z.string().or(z.date()),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CHECK", "DEBIT_CARD", "CREDIT_CARD", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

// Nueva función para marcar pago recibido por mes/año
const markPaymentReceivedSchema = z.object({
  unitId: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
  received: z.boolean(),
})

export async function markPaymentReceived(data: { unitId: string; period: string; received: boolean }) {
  try {
    const userId = await getDefaultUserId()
    
    // Validate input with better error handling
    const validated = markPaymentReceivedSchema.parse({
      unitId: String(data.unitId || ""),
      period: String(data.period || ""),
      received: Boolean(data.received),
    })

    // Obtener la unidad
    let unit
    try {
      unit = await prisma.unit.findFirst({
        where: { id: validated.unitId, userId },
        include: { propertyGroup: true },
      })
    } catch (error: any) {
      // Si propertyGroup no está disponible, obtener sin la relación
      unit = await prisma.unit.findFirst({
        where: { id: validated.unitId, userId },
      })
    }

    if (!unit) {
      throw new Error("Unidad no encontrada")
    }

    // Buscar rental period activo para este período (opcional)
    const periodStart = new Date(validated.period + "-01")
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0)

    const activeRentalPeriod = await prisma.rentalPeriod.findFirst({
      where: {
        unitId: validated.unitId,
        status: "ACTIVE",
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      include: { tenant: true },
    })

    if (validated.received) {
      // Marcar como recibido: crear/actualizar statement
      // Si hay rental period activo, usar sus datos; si no, usar valores por defecto
      const alquiler = activeRentalPeriod
        ? (typeof activeRentalPeriod.priceAmount === 'number'
            ? activeRentalPeriod.priceAmount
            : activeRentalPeriod.priceAmount.toNumber())
        : 0 // Valor por defecto si no hay rental period
      
      const currency = activeRentalPeriod?.currency || "ARS"
      const tenantId = activeRentalPeriod?.tenantId || undefined
      
      const expensas = unit.monthlyExpensesAmount
        ? (unit.monthlyExpensesAmount instanceof Decimal
            ? unit.monthlyExpensesAmount.toNumber()
            : Number(unit.monthlyExpensesAmount))
        : undefined

      // Verificar si monthlyStatement está disponible antes de crear/actualizar
      if ((prisma as any).monthlyStatement) {
        // Crear/actualizar el statement mensual
        await upsertStatement({
          period: validated.period,
          unitId: validated.unitId,
          tenantId,
          alquiler: alquiler.toString(),
          osse: undefined,
          inmob: undefined,
          tsu: undefined,
          obras: undefined,
          otrosTotal: undefined,
          expensas: expensas ? expensas.toString() : undefined,
          notes: `Pago recibido - ${new Date().toLocaleDateString()}`,
        })
      }

      // Crear registro de pago siempre (incluso si no hay rental period)
      // Esto permite marcar pagos recibidos incluso sin rental period activo
      await prisma.payment.create({
        data: {
          userId,
          unitId: validated.unitId,
          rentalPeriodId: activeRentalPeriod?.id || null,
          amount: alquiler,
          currency,
          paymentDate: new Date(),
          paymentMethod: "TRANSFER", // Default, puede ser configurable
          notes: `Pago mensual ${validated.period}`,
        },
      })
    } else {
      // Marcar como no recibido: eliminar statement y pago del mes
      // Eliminar statement (solo si monthlyStatement está disponible)
      if ((prisma as any).monthlyStatement) {
        try {
          const statement = await (prisma as any).monthlyStatement.findFirst({
            where: {
              period: validated.period,
              unitId: validated.unitId,
            },
          })

          if (statement) {
            await (prisma as any).monthlyStatement.delete({
              where: { id: statement.id },
            })
          }
        } catch (error) {
          console.warn("Error deleting statement:", error)
        }
      }

      // Eliminar pagos del mes
      await prisma.payment.deleteMany({
        where: {
          unitId: validated.unitId,
          paymentDate: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      })
    }

    revalidatePath("/payments")
    revalidatePath("/statements")
    revalidatePath("/bi")
    revalidatePath("/expenses")

    return { success: true }
  } catch (error: any) {
    console.error("Error in markPaymentReceived:", error)
    if (error instanceof z.ZodError) {
      throw new Error(`Datos inválidos: ${error.errors.map((e: any) => e.message).join(", ")}`)
    }
    throw error
  }
}

// Función para obtener el estado de pagos por unidad y período
export async function getPaymentStatus(unitId: string, period: string) {
  const userId = await getDefaultUserId()

  // Verificar si hay statement para este período
  const statement = await (prisma as any).monthlyStatement.findFirst({
    where: {
      period,
      unitId,
      unit: { userId },
    },
  })

  return {
    received: !!statement,
    statementId: statement?.id || null,
  }
}

// Función para obtener estados de pagos para todas las unidades en un período
export async function getPaymentsStatusByPeriod(period: string) {
  const userId = await getDefaultUserId()

  // Verificar si propertyGroup está disponible en Prisma Client
  let units
  try {
    units = await prisma.unit.findMany({
      where: { userId, archived: false },
      include: {
        propertyGroup: true,
      },
    })
  } catch (error: any) {
    // Si propertyGroup no está disponible, obtener unidades sin la relación
    console.warn('PropertyGroup relation not available, fetching units without it')
    units = await prisma.unit.findMany({
      where: { userId, archived: false },
    })
  }

  // Verificar si monthlyStatement está disponible
  let statements: any[] = []
  try {
    if ((prisma as any).monthlyStatement) {
      statements = await (prisma as any).monthlyStatement.findMany({
        where: {
          period,
          unit: { userId },
        },
      })
    }
  } catch (error: any) {
    console.warn('MonthlyStatement model not available')
  }

  // También verificar pagos del período para asegurar que se detecten correctamente
  const periodStart = new Date(period + "-01")
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0)
  
  const payments = await prisma.payment.findMany({
    where: {
      userId,
      paymentDate: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    select: {
      unitId: true,
    },
  })

  // Crear map de unidades con pagos recibidos (por statement o por payment)
  const statementMap = new Map(statements.map((s: any) => [s.unitId, true]))
  const paymentMap = new Map(payments.map(p => [p.unitId, true]))
  
  // Una unidad tiene pago recibido si tiene statement O payment
  const statusMap = new Map<string, boolean>()
  units.forEach(unit => {
    statusMap.set(unit.id, statementMap.has(unit.id) || paymentMap.has(unit.id))
  })

  return units.map(unit => ({
    unitId: unit.id,
    unitName: unit.name,
    propertyGroup: (unit as any).propertyGroup || null,
    received: statusMap.get(unit.id) || false,
  }))
}

export async function createPayment(data: z.infer<typeof paymentSchema>) {
  // Verify unit exists
  const unit = await prisma.unit.findFirst({
    where: { id: data.unitId },
  })
  if (!unit) throw new Error("Unit not found")

  const validated = paymentSchema.parse(data)
  const userId = await getDefaultUserId()
  
  const paymentResult = await prisma.payment.create({
    data: {
      userId,
      unitId: validated.unitId,
      rentalPeriodId: validated.rentalPeriodId,
      amount: typeof validated.amount === "string"
        ? parseFloat(validated.amount)
        : validated.amount,
      currency: validated.currency,
      paymentDate: validated.paymentDate instanceof Date
        ? validated.paymentDate
        : new Date(validated.paymentDate),
      paymentMethod: validated.paymentMethod,
      reference: validated.reference,
      notes: validated.notes,
    },
    include: {
      unit: true,
      rentalPeriod: true,
    },
  })

  revalidatePath("/payments")
  revalidatePath("/statements")
  revalidatePath("/bi")

  // Convert Decimal to number for client components
  return {
    ...paymentResult,
    amount: paymentResult.amount instanceof Decimal
      ? paymentResult.amount.toNumber()
      : typeof paymentResult.amount === 'string'
        ? parseFloat(paymentResult.amount)
        : paymentResult.amount,
    rentalPeriod: paymentResult.rentalPeriod ? {
      ...paymentResult.rentalPeriod,
      priceAmount: paymentResult.rentalPeriod.priceAmount instanceof Decimal
        ? paymentResult.rentalPeriod.priceAmount.toNumber()
        : typeof paymentResult.rentalPeriod.priceAmount === 'string'
          ? parseFloat(paymentResult.rentalPeriod.priceAmount)
          : paymentResult.rentalPeriod.priceAmount,
    } : null,
  }
}

export async function updatePayment(
  id: string,
  data: Partial<z.infer<typeof paymentSchema>>
) {
  const userId = await getDefaultUserId()
  
  const existingPayment = await prisma.payment.findFirst({
    where: { id, userId },
  })

  if (!existingPayment) {
    throw new Error("Payment not found")
  }

  const validated = paymentSchema.partial().parse(data)
  
  const updateData: any = {}
  if (validated.amount !== undefined) {
    updateData.amount = typeof validated.amount === "string"
      ? parseFloat(validated.amount)
      : validated.amount
  }
  if (validated.currency !== undefined) updateData.currency = validated.currency
  if (validated.paymentDate !== undefined) {
    updateData.paymentDate = validated.paymentDate instanceof Date
      ? validated.paymentDate
      : new Date(validated.paymentDate)
  }
  if (validated.paymentMethod !== undefined) updateData.paymentMethod = validated.paymentMethod
  if (validated.reference !== undefined) updateData.reference = validated.reference
  if (validated.notes !== undefined) updateData.notes = validated.notes

  const updated = await prisma.payment.update({
    where: { id },
    data: updateData,
    include: {
      unit: true,
      rentalPeriod: true,
    },
  })

  revalidatePath("/payments")
  revalidatePath("/statements")
  revalidatePath("/bi")

  return {
    ...updated,
    amount: updated.amount instanceof Decimal
      ? updated.amount.toNumber()
      : typeof updated.amount === 'string'
        ? parseFloat(updated.amount)
        : updated.amount,
    rentalPeriod: updated.rentalPeriod ? {
      ...updated.rentalPeriod,
      priceAmount: updated.rentalPeriod.priceAmount instanceof Decimal
        ? updated.rentalPeriod.priceAmount.toNumber()
        : typeof updated.rentalPeriod.priceAmount === 'string'
          ? parseFloat(updated.rentalPeriod.priceAmount)
          : updated.rentalPeriod.priceAmount,
    } : null,
  }
}

export async function deletePayment(id: string) {
  const userId = await getDefaultUserId()
  
  const payment = await prisma.payment.findFirst({
    where: { id, userId },
  })

  if (!payment) {
    throw new Error("Payment not found")
  }

  await prisma.payment.delete({
    where: { id },
  })

  revalidatePath("/payments")
  revalidatePath("/statements")
  revalidatePath("/bi")
}

export async function getPayments() {
  const userId = await getDefaultUserId()
  
  const payments = await prisma.payment.findMany({
    where: { userId },
    include: {
      unit: true,
      rentalPeriod: {
        include: {
          tenant: true,
        },
      },
    },
    orderBy: { paymentDate: "desc" },
  })

  // Convert Decimal to number recursively
  const decimalToNumber = (value: any): any => {
    if (value instanceof Decimal) {
      return value.toNumber()
    }
    if (typeof value === 'string' && !isNaN(parseFloat(value))) {
      return parseFloat(value)
    }
    if (Array.isArray(value)) {
      return value.map(decimalToNumber)
    }
    if (value && typeof value === 'object') {
      const result: any = {}
      for (const key in value) {
        result[key] = decimalToNumber(value[key])
      }
      return result
    }
    return value
  }

  return payments.map(p => decimalToNumber(p))
}

export async function getPayment(id: string) {
  const userId = await getDefaultUserId()
  
  const payment = await prisma.payment.findFirst({
    where: { id, userId },
    include: {
      unit: true,
      rentalPeriod: {
        include: {
          tenant: true,
        },
      },
    },
  })

  if (!payment) return null

  // Convert Decimal to number
  return {
    ...payment,
    amount: payment.amount instanceof Decimal
      ? payment.amount.toNumber()
      : typeof payment.amount === 'string'
        ? parseFloat(payment.amount)
        : payment.amount,
    rentalPeriod: payment.rentalPeriod ? {
      ...payment.rentalPeriod,
      priceAmount: payment.rentalPeriod.priceAmount instanceof Decimal
        ? payment.rentalPeriod.priceAmount.toNumber()
        : typeof payment.rentalPeriod.priceAmount === 'string'
          ? parseFloat(payment.rentalPeriod.priceAmount)
          : payment.rentalPeriod.priceAmount,
    } : null,
  }
}
