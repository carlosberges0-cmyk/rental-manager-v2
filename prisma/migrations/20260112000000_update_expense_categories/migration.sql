-- Step 1: Create new enum type with new values
CREATE TYPE "ExpenseCategory_new" AS ENUM ('OSSE', 'INMOB', 'TSU', 'OBRAS', 'OTROS');

-- Step 2: Alter the column to use text temporarily
ALTER TABLE "MonthlyExpense" 
  ALTER COLUMN category TYPE text;

-- Step 3: Update existing expenses to use valid categories
-- Convert old categories to OTROS (they all become OTROS in the new system)
UPDATE "MonthlyExpense" 
SET category = 'OTROS'
WHERE category IN ('EXPENSAS', 'MANTENIMIENTO', 'SERVICIOS', 'SEGURO');

-- Step 4: Alter the column to use the new enum type
ALTER TABLE "MonthlyExpense" 
  ALTER COLUMN category TYPE "ExpenseCategory_new" 
  USING category::"ExpenseCategory_new";

-- Step 5: Drop the old enum type
DROP TYPE "ExpenseCategory";

-- Step 6: Rename the new enum type to the original name
ALTER TYPE "ExpenseCategory_new" RENAME TO "ExpenseCategory";
