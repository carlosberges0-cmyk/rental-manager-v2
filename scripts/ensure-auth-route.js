#!/usr/bin/env node
/**
 * Garantiza que la ruta de auth tenga el código correcto (evita caché de Vercel).
 * Se ejecuta antes del build.
 */
const fs = require("fs");
const path = require("path");

const ROUTE_PATH = path.join(
  __dirname,
  "..",
  "app",
  "api",
  "auth",
  "[...nextauth]",
  "route.ts"
);

const CORRECT_CONTENT = `import type { NextRequest } from "next/server"
import { handlers } from "@/lib/auth"

export async function GET(req: NextRequest) {
  return handlers.GET(req)
}

export async function POST(req: NextRequest) {
  return handlers.POST(req)
}
`;

fs.writeFileSync(ROUTE_PATH, CORRECT_CONTENT);
console.log("[ensure-auth-route] Route file updated");
