// Postinstall script: ensure auth route + Prisma Client
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Fix auth route (evita error de tipos con wrap/caché en Vercel)
const routePath = path.join(__dirname, 'app', 'api', 'auth', '[...nextauth]', 'route.ts');
const routeContent = `import type { NextRequest } from "next/server"
import { handlers } from "@/lib/auth"

export async function GET(req: NextRequest) {
  return handlers.GET(req)
}

export async function POST(req: NextRequest) {
  return handlers.POST(req)
}
`;
try {
  fs.writeFileSync(routePath, routeContent);
  console.log('✅ Auth route file ensured');
} catch (e) {
  console.warn('⚠️  Could not write auth route:', e.message);
}

console.log('🔧 Generating Prisma Client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma Client generated successfully');
} catch (error) {
  console.warn('⚠️  Failed to generate Prisma Client. Please run "npx prisma generate" manually.');
  process.exit(0); // Don't fail the install if this fails
}
