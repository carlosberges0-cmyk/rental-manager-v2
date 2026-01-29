import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Ejecutando migración del enum ExpenseCategory...\n')

  try {
    console.log('📝 Paso 1: Creando nuevo enum type...')
    await prisma.$executeRawUnsafe(`
      CREATE TYPE "ExpenseCategory_new" AS ENUM ('OSSE', 'INMOB', 'TSU', 'OBRAS', 'OTROS');
    `)
    console.log('  ✅ Enum creado\n')

    console.log('📝 Paso 2: Convirtiendo columna a text...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "MonthlyExpense" 
        ALTER COLUMN category TYPE text;
    `)
    console.log('  ✅ Columna convertida a text\n')

    console.log('📝 Paso 3: Actualizando categorías existentes a OTROS...')
    await prisma.$executeRawUnsafe(`
      UPDATE "MonthlyExpense" 
      SET category = 'OTROS'
      WHERE category IN ('EXPENSAS', 'MANTENIMIENTO', 'SERVICIOS', 'SEGURO');
    `)
    console.log('  ✅ Categorías actualizadas\n')

    console.log('📝 Paso 4: Convirtiendo columna al nuevo enum...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "MonthlyExpense" 
        ALTER COLUMN category TYPE "ExpenseCategory_new" 
        USING category::"ExpenseCategory_new";
    `)
    console.log('  ✅ Columna convertida al nuevo enum\n')

    console.log('📝 Paso 5: Eliminando enum antiguo...')
    await prisma.$executeRawUnsafe(`
      DROP TYPE "ExpenseCategory";
    `)
    console.log('  ✅ Enum antiguo eliminado\n')

    console.log('📝 Paso 6: Renombrando nuevo enum...')
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "ExpenseCategory_new" RENAME TO "ExpenseCategory";
    `)
    console.log('  ✅ Enum renombrado\n')

    console.log('✅ Migración ejecutada exitosamente!')
    console.log('\nAhora regenera el Prisma Client:')
    console.log('  npx prisma generate\n')
  } catch (error: any) {
    // Si el error es que el tipo ya existe, intentar continuar
    if (error.message?.includes('already exists')) {
      console.log('  ⚠️  El enum ya existe, continuando...\n')
      try {
        // Intentar los siguientes pasos
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "MonthlyExpense" 
            ALTER COLUMN category TYPE text;
        `)
        await prisma.$executeRawUnsafe(`
          UPDATE "MonthlyExpense" 
          SET category = 'OTROS'
          WHERE category IN ('EXPENSAS', 'MANTENIMIENTO', 'SERVICIOS', 'SEGURO');
        `)
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "MonthlyExpense" 
            ALTER COLUMN category TYPE "ExpenseCategory_new" 
            USING category::"ExpenseCategory_new";
        `)
        await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "ExpenseCategory";`)
        await prisma.$executeRawUnsafe(`
          ALTER TYPE "ExpenseCategory_new" RENAME TO "ExpenseCategory";
        `)
        console.log('✅ Migración completada!\n')
      } catch (e: any) {
        console.error('\n❌ Error al ejecutar la migración:')
        console.error(e.message)
        process.exit(1)
      }
    } else {
      console.error('\n❌ Error al ejecutar la migración:')
      console.error(error.message)
      process.exit(1)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main()
