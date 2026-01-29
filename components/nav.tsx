"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, TrendingUp, Settings, Receipt } from "lucide-react"

const navItems = [
  { href: "/units", label: "Unidades", icon: Home },
  { href: "/statements", label: "Liquidaciones", icon: Receipt },
  { href: "/bi", label: "BI", icon: TrendingUp },
  { href: "/settings", label: "Configuración", icon: Settings },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-gray-100" style={{ backgroundColor: '#1B5E20' }}>
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center gap-6">
          <Link href="/statements" className="font-bold text-xl text-white">
            Rental Manager
          </Link>
          <div className="flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white text-[#1B5E20]"
                      : "text-white/90 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
