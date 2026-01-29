"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const tenantSchema = z.object({
  name: z.string().min(1),
  documentId: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
})

export async function createTenant(data: z.infer<typeof tenantSchema>) {
  const validated = tenantSchema.parse(data)
  
  const tenant = await prisma.tenant.create({
    data: validated,
  })

  revalidatePath("/calendar")
  return tenant
}

export async function updateTenant(id: string, data: z.infer<typeof tenantSchema>) {
  const validated = tenantSchema.parse(data)
  
  const tenant = await prisma.tenant.update({
    where: { id },
    data: validated,
  })

  revalidatePath("/calendar")
  return tenant
}

export async function getTenants() {
  return prisma.tenant.findMany({
    orderBy: { name: "asc" },
  })
}
