import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create a test user (for schema compatibility)
  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      name: "Test User",
      emailVerified: new Date(),
    },
  })

  console.log("Created user:", user.email)

  // Create tax profile
  const taxProfile = await prisma.taxProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      ivaEnabled: true,
      ivaRatePercent: 21,
      iibbEnabled: true,
      iibbRatePercent: 3.5,
      igEstimatePercent: 15,
    },
  })

  console.log("Created tax profile")

  // Create units
  const unit1 = await prisma.unit.create({
    data: {
      userId: user.id,
      name: "Departamento A",
      address: "Av. Corrientes 1234, CABA",
      type: "DEPTO",
      notes: "2 ambientes, 50m²",
    },
  })

  const unit2 = await prisma.unit.create({
    data: {
      userId: user.id,
      name: "Casa B",
      address: "Av. Santa Fe 5678, CABA",
      type: "CASA",
      notes: "3 dormitorios, patio",
    },
  })

  console.log("Created units")

  // Create tenants
  const tenant1 = await prisma.tenant.create({
    data: {
      name: "Juan Pérez",
      documentId: "12345678",
      email: "juan@example.com",
      phone: "+54 11 1234-5678",
    },
  })

  const tenant2 = await prisma.tenant.create({
    data: {
      name: "María González",
      documentId: "87654321",
      email: "maria@example.com",
      phone: "+54 11 9876-5432",
    },
  })

  console.log("Created tenants")

  // Create rental periods
  const now = new Date()
  const nextMonth = new Date(now)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const inTwoMonths = new Date(now)
  inTwoMonths.setMonth(inTwoMonths.getMonth() + 2)

  await prisma.rentalPeriod.create({
    data: {
      unitId: unit1.id,
      tenantId: tenant1.id,
      startDate: now,
      endDate: nextMonth,
      priceAmount: 150000,
      currency: "ARS",
      billingFrequency: "MONTHLY",
      status: "ACTIVE",
      notes: "Contrato anual",
    },
  })

  await prisma.rentalPeriod.create({
    data: {
      unitId: unit2.id,
      tenantId: tenant2.id,
      startDate: now,
      endDate: inTwoMonths,
      priceAmount: 200000,
      currency: "ARS",
      billingFrequency: "MONTHLY",
      status: "ACTIVE",
      notes: "Contrato con opción a compra",
    },
  })

  console.log("Created rental periods")

  // Create expenses
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  await prisma.monthlyExpense.create({
    data: {
      unitId: unit1.id,
      month: currentMonth,
      category: "EXPENSAS",
      description: "Expensas del mes",
      amount: 15000,
      currency: "ARS",
      deductibleFlag: true,
      totalAmount: 15000, // Required field: amount + taxes (if any)
    },
  })

  await prisma.monthlyExpense.create({
    data: {
      unitId: unit1.id,
      month: currentMonth,
      category: "MANTENIMIENTO",
      description: "Reparación de calefacción",
      amount: 5000,
      currency: "ARS",
      deductibleFlag: true,
      vendor: "Servicio Técnico XYZ",
      totalAmount: 5000, // Required field: amount + taxes (if any)
    },
  })

  await prisma.monthlyExpense.create({
    data: {
      unitId: unit2.id,
      month: currentMonth,
      category: "SERVICIOS",
      description: "Limpieza mensual",
      amount: 8000,
      currency: "ARS",
      deductibleFlag: true,
      totalAmount: 8000, // Required field: amount + taxes (if any)
    },
  })

  console.log("Created expenses")

  console.log("Seed completed!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
