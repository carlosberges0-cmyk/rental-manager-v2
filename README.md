# Rental Manager v2

Sistema de gestión de alquileres para Argentina. MVP completo con funcionalidades de calendario, gestión de unidades, gastos, análisis de negocio, facturación y exportación de datos.

## 🚀 Tecnologías

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS 4** para estilos
- **Prisma** + PostgreSQL para base de datos
- **NextAuth** con autenticación por email (magic link)
- **shadcn/ui** para componentes UI
- **recharts** para gráficos
- **zod** para validación de datos
- **xlsx** para exportación a Excel

## 📋 Requisitos Previos

- Node.js 18+ 
- PostgreSQL 12+
- npm o yarn

## 🛠️ Instalación

1. **Clonar el repositorio** (si aplica) o navegar al directorio del proyecto

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   
   Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/rental_manager?schema=public"

   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here" # Genera uno con: openssl rand -base64 32

   # Email (para magic links)
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="587"
   SMTP_USER="your-email@gmail.com"
   SMTP_PASSWORD="your-app-password"
   SMTP_FROM="noreply@yourdomain.com"

   # Invoice Provider (opcional, para producción)
   INVOICE_PROVIDER="mock" # o "afip" cuando implementes la integración real
   ```

4. **Configurar la base de datos:**
   ```bash
   # Generar cliente Prisma
   npm run db:generate

   # Crear/actualizar esquema de base de datos
   npm run db:push

   # O usar migraciones (recomendado para producción)
   npm run db:migrate
   ```

5. **Poblar la base de datos con datos de ejemplo:**
   ```bash
   npm run db:seed
   ```

6. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

7. **Abrir en el navegador:**
   ```
   http://localhost:3000
   ```

## 📁 Estructura del Proyecto

```
rental-manager-v2/
├── app/                    # Páginas y rutas (App Router)
│   ├── api/               # API routes
│   ├── auth/              # Páginas de autenticación
│   ├── calendar/          # Vista de calendario principal
│   ├── units/             # Gestión de unidades
│   ├── expenses/          # Gestión de gastos
│   ├── bi/                # Business Intelligence
│   ├── invoicing/         # Facturación
│   ├── export/            # Exportación de datos
│   └── settings/          # Configuración
├── components/            # Componentes React
│   ├── ui/               # Componentes UI base (shadcn)
│   ├── calendar/         # Componentes del calendario
│   ├── units/            # Componentes de unidades
│   ├── expenses/         # Componentes de gastos
│   ├── bi/               # Componentes de BI
│   ├── invoicing/        # Componentes de facturación
│   ├── export/           # Componentes de exportación
│   └── settings/         # Componentes de configuración
├── lib/                   # Utilidades y lógica de negocio
│   ├── actions/          # Server actions (CRUD)
│   ├── invoicing/        # Proveedores de facturación
│   ├── auth.ts           # Configuración NextAuth
│   ├── prisma.ts         # Cliente Prisma
│   └── utils.ts          # Utilidades generales
├── prisma/                # Schema y migraciones
│   ├── schema.prisma     # Esquema de base de datos
│   └── seed.ts           # Datos de ejemplo
└── public/               # Archivos estáticos
```

## 🗄️ Modelo de Datos

El sistema incluye los siguientes modelos principales:

- **User**: Usuarios del sistema
- **Unit**: Unidades de alquiler (departamentos, casas, cocheras)
- **Tenant**: Inquilinos (opcional en MVP)
- **RentalPeriod**: Períodos de alquiler con precios y fechas
- **MonthlyExpense**: Gastos mensuales por unidad
- **TaxProfile**: Configuración fiscal del usuario
- **Invoice**: Facturas emitidas
- **TaxWithholdingRule**: Reglas de retención de impuestos (futuro)

## 🔐 Autenticación

El sistema usa NextAuth con autenticación por email (magic link). Los usuarios reciben un enlace por email para iniciar sesión.

## 📊 Funcionalidades Principales

### 1. Calendario
- Vista de calendario con scroll horizontal infinito
- Visualización de períodos de alquiler como bloques de colores
- Filtros por unidad, tipo, ocupación
- Zoom: Día / Semana / Mes
- Creación rápida de unidades y períodos de alquiler

### 2. Gestión de Unidades
- CRUD completo de unidades
- Tipos: Departamento, Casa, Cochera, Otro
- Archivar unidades (soft delete)

### 3. Gestión de Gastos
- Gastos mensuales por unidad
- Categorías: Expensas, Mantenimiento, Servicios, Seguro, Otros
- Flag de deducibilidad para impuestos
- Asociación con vendor/proveedor

### 4. Business Intelligence
- KPIs: Ingresos YTD, Gastos YTD, Margen, Rentabilidad, Ocupación
- Gráficos de ingresos vs gastos (últimos 12 meses)
- Gráfico de gastos por categoría
- Resumen de impuestos (IVA, IIBB, IG estimación)

### 5. Facturación
- Creación de facturas
- Integración con proveedor mock (MVP)
- Estructura preparada para integración con AFIP/ARCA
- Almacenamiento de CAE y datos externos

### 6. Exportación
- Exportación a Excel de:
  - Resumen mensual (ingresos, gastos, impuestos)
  - Gastos detallados
  - Períodos de alquiler
- Formato contador-friendly

### 7. Configuración Fiscal
- Configuración de IVA (habilitado/deshabilitado, tasa)
- Configuración de IIBB (habilitado/deshabilitado, tasa)
- Estimación de Impuesto a las Ganancias
- Cálculos automáticos con disclaimer

## 🧮 Cálculos de Impuestos

El sistema calcula automáticamente:

- **IVA**: Sobre ingresos brutos (si está habilitado)
- **IIBB**: Sobre ingresos brutos (si está habilitado)
- **IG (Estimación)**: Sobre resultado neto (configurable)
- **Gastos Deducibles**: Suma de gastos marcados como deducibles

**Importante**: Todos los cálculos son orientativos. Se debe validar con un contador profesional.

## 🔌 Integración AFIP (Futuro)

El sistema está preparado para integrar con AFIP/ARCA. Para implementar:

1. Revisa `lib/invoicing/provider.ts`
2. Implementa `AFIPInvoiceProvider` siguiendo la documentación de AFIP
3. Configura las variables de entorno:
   ```env
   AFIP_CUIT="tu-cuit"
   AFIP_CERT_PATH="/path/to/cert.pem"
   AFIP_KEY_PATH="/path/to/key.pem"
   AFIP_ENVIRONMENT="test" # o "production"
   ```
4. Cambia `INVOICE_PROVIDER` a `"afip"` en `.env`

## 📝 Scripts Disponibles

- `npm run dev` - Inicia servidor de desarrollo
- `npm run build` - Construye para producción
- `npm run start` - Inicia servidor de producción
- `npm run lint` - Ejecuta linter
- `npm run db:generate` - Genera cliente Prisma
- `npm run db:push` - Sincroniza schema con DB (desarrollo)
- `npm run db:migrate` - Crea migración (producción)
- `npm run db:seed` - Pobla DB con datos de ejemplo
- `npm run db:studio` - Abre Prisma Studio (GUI para DB)

## 🚢 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno en el dashboard
3. Asegúrate de tener una base de datos PostgreSQL (Vercel Postgres, Supabase, etc.)
4. Vercel ejecutará automáticamente `npm run build`

### Otras Plataformas

El proyecto es compatible con cualquier plataforma que soporte Next.js:
- Railway
- Render
- DigitalOcean App Platform
- AWS Amplify

**Nota**: Asegúrate de configurar todas las variables de entorno en tu plataforma de despliegue.

## 🔧 Troubleshooting

### Error de conexión a base de datos
- Verifica que PostgreSQL esté corriendo
- Revisa la `DATABASE_URL` en `.env`
- Asegúrate de que el usuario tenga permisos

### Error de autenticación
- Verifica `NEXTAUTH_SECRET` y `NEXTAUTH_URL`
- Revisa configuración de SMTP para magic links

### Errores de Prisma
- Ejecuta `npm run db:generate` después de cambios en schema
- Usa `npm run db:push` para desarrollo o `npm run db:migrate` para producción

## 📄 Licencia

Este proyecto es privado.

## 👥 Contribuciones

Este es un proyecto MVP. Las mejoras y extensiones son bienvenidas.

---

**Desarrollado con ❤️ para gestión de alquileres en Argentina**
