-- CreateEnum
CREATE TYPE "TenantCondition" AS ENUM ('VIVIENDA', 'LOCAL_COMERCIAL', 'OTRO');

-- CreateEnum
CREATE TYPE "StatementItemType" AS ENUM ('CHARGE', 'DEDUCTION', 'INFO');

-- AlterEnum (add new values to UnitType)
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'VIVIENDA';
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'LOCAL_COMERCIAL';

-- CreateTable
CREATE TABLE IF NOT EXISTS "PropertyGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MonthlyStatement" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT,
    "alquiler" DECIMAL(10,2) NOT NULL,
    "osse" DECIMAL(10,2),
    "inmob" DECIMAL(10,2),
    "tsu" DECIMAL(10,2),
    "obras" DECIMAL(10,2),
    "otrosTotal" DECIMAL(10,2),
    "expensas" DECIMAL(10,2),
    "ivaAlquiler" DECIMAL(10,2),
    "totalMes" DECIMAL(10,2) NOT NULL,
    "neto" DECIMAL(10,2) NOT NULL,
    "gastos" DECIMAL(10,2) NOT NULL,
    "neteado" DECIMAL(10,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StatementItem" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "type" "StatementItemType" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "isDeduction" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatementItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable (add new columns to Unit)
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "propertyGroupId" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "owner" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "aplicaIvaAlquiler" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "aplicaIibbRetencion" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "monthlyExpensesAmount" DECIMAL(10,2);

-- AlterTable (add new columns to Tenant)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "cuit" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "condicion" "TenantCondition" NOT NULL DEFAULT 'OTRO';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PropertyGroup_userId_idx" ON "PropertyGroup"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Unit_propertyGroupId_idx" ON "Unit"("propertyGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MonthlyStatement_period_idx" ON "MonthlyStatement"("period");
CREATE INDEX IF NOT EXISTS "MonthlyStatement_unitId_idx" ON "MonthlyStatement"("unitId");
CREATE INDEX IF NOT EXISTS "MonthlyStatement_tenantId_idx" ON "MonthlyStatement"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyStatement_unitId_period_key" ON "MonthlyStatement"("unitId", "period");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StatementItem_statementId_idx" ON "StatementItem"("statementId");

-- AddForeignKey
ALTER TABLE "PropertyGroup" ADD CONSTRAINT "PropertyGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyGroupId_fkey" FOREIGN KEY ("propertyGroupId") REFERENCES "PropertyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyStatement" ADD CONSTRAINT "MonthlyStatement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyStatement" ADD CONSTRAINT "MonthlyStatement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementItem" ADD CONSTRAINT "StatementItem_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "MonthlyStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
