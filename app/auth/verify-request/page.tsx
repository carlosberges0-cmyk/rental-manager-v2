import { redirect } from "next/navigation"

export default function VerifyRequestPage() {
  redirect("/auth/signin")
}
