-- AlterTable
ALTER TABLE "MonthlyExpense" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "igAmount" DECIMAL(10,2),
ADD COLUMN     "igRatePercent" DECIMAL(5,2),
ADD COLUMN     "iibbAmount" DECIMAL(10,2),
ADD COLUMN     "iibbRatePercent" DECIMAL(5,2),
ADD COLUMN     "ivaAmount" DECIMAL(10,2),
ADD COLUMN     "ivaRatePercent" DECIMAL(5,2),
ADD COLUMN     "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Update existing rows: set date based on month and createdAt, set totalAmount = amount
UPDATE "MonthlyExpense" 
SET "date" = COALESCE("createdAt", CURRENT_TIMESTAMP),
    "totalAmount" = "amount";

-- CreateIndex
CREATE INDEX "MonthlyExpense_date_idx" ON "MonthlyExpense"("date");
