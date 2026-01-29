#!/bin/bash

# Script para ejecutar la migración SQL manual del enum ExpenseCategory

echo "🔄 Ejecutando migración del enum ExpenseCategory..."
echo ""

# Leer DATABASE_URL del archivo .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL no encontrado en .env"
  echo "Por favor, asegúrate de que DATABASE_URL esté configurado en tu archivo .env"
  exit 1
fi

echo "📝 Ejecutando migración SQL..."
echo ""

# Ejecutar la migración SQL usando psql
psql "$DATABASE_URL" -f prisma/migrations/20260112000000_update_expense_categories/migration.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migración ejecutada exitosamente!"
  echo ""
  echo "Ahora regenera el Prisma Client:"
  echo "  npx prisma generate"
  echo ""
else
  echo ""
  echo "❌ Error al ejecutar la migración"
  echo ""
  echo "Si no tienes psql instalado, puedes ejecutar el SQL manualmente:"
  echo "1. Conecta a tu base de datos PostgreSQL"
  echo "2. Ejecuta el contenido de: prisma/migrations/20260112000000_update_expense_categories/migration.sql"
  exit 1
fi
