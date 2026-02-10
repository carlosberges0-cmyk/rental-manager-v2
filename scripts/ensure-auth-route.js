#!/usr/bin/env node
/**
 * Garantiza que la ruta de auth tenga el código correcto (evita caché de Vercel).
 */
const fs = require("fs");
const path = require("path");

const ROUTE_PATH = path.resolve(process.cwd(), "app", "api", "auth", "[...nextauth]", "route.ts");

const CORRECT_CONTENT = `import type { NextRequest } from "next/server"
import { handlers } from "@/lib/auth"

export async function GET(req: NextRequest) {
  return handlers.GET(req)
}

export async function POST(req: NextRequest) {
  return handlers.POST(req)
}
`;

const hadWrap = fs.existsSync(ROUTE_PATH) && fs.readFileSync(ROUTE_PATH, "utf8").includes("wrap");
fs.writeFileSync(ROUTE_PATH, CORRECT_CONTENT);
const verified = fs.readFileSync(ROUTE_PATH, "utf8").includes("NextRequest");
console.log("[ensure-auth-route] OK", { hadWrap, verified, path: ROUTE_PATH });
if (!verified) process.exit(1);
