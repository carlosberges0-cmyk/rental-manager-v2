import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In development, clear cached instance if models are missing
if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
  try {
    // @ts-ignore
    if (typeof globalForPrisma.prisma.unit === 'undefined') {
      console.warn('⚠️  Clearing cached Prisma Client instance - Unit model missing. Please run "npx prisma generate"')
      globalForPrisma.prisma = undefined
    }
  } catch (e) {
    // If accessing prisma.unit throws an error, clear the cache
    console.warn('⚠️  Clearing cached Prisma Client instance - error accessing models. Please run "npx prisma generate"')
    globalForPrisma.prisma = undefined
  }
}

// Create a new Prisma Client instance
let prismaClient: PrismaClient
try {
  prismaClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
} catch (error: any) {
  console.error('❌ Failed to create Prisma Client:', error.message)
  throw new Error('Failed to initialize Prisma Client. Please run "npx prisma generate" and restart the server.')
}

// Verify essential models are available immediately after creation
// @ts-ignore
if (typeof prismaClient.unit === 'undefined') {
  const errorMsg = 'Unit model is not available in Prisma Client. Please run "npx prisma generate" and restart the server.'
  console.error('❌', errorMsg)
  throw new Error(errorMsg)
}
// @ts-ignore
if (typeof prismaClient.payment === 'undefined') {
  console.warn('⚠️  Payment model is not available in Prisma Client. Please run "npx prisma generate" if you need payments.')
}
// @ts-ignore
if (typeof prismaClient.monthlyStatement === 'undefined') {
  console.warn('⚠️  MonthlyStatement model is not available in Prisma Client. Please run "npx prisma generate" and "npx prisma migrate dev" if you need statements.')
}
// @ts-ignore
if (typeof prismaClient.propertyGroup === 'undefined') {
  console.warn('⚠️  PropertyGroup model is not available in Prisma Client. Please run "npx prisma generate" and "npx prisma migrate dev" if you need property groups.')
}

export const prisma = globalForPrisma.prisma ?? prismaClient

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
