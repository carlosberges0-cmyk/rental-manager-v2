"use server"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

// Get the current user ID from the session
export async function getCurrentUserId(): Promise<string> {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  return session.user.id
}

// Deprecated: Use getCurrentUserId instead
// Kept for backward compatibility during migration
export async function getDefaultUserId(): Promise<string> {
  return getCurrentUserId()
}
