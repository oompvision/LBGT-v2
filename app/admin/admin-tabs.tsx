"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface AdminTabsProps {
  className?: string
}

export function AdminTabs({ className }: AdminTabsProps) {
  const pathname = usePathname()

  const tabs = [
    {
      name: "Dashboard",
      href: "/admin/dashboard",
      isActive: pathname === "/admin/dashboard",
    },
    {
      name: "Users",
      href: "/admin/users",
      isActive: pathname === "/admin/users",
    },
    {
      name: "Applications",
      href: "/admin/applications",
      isActive: pathname === "/admin/applications",
    },
    {
      name: "Messages",
      href: "/admin/messages",
      isActive: pathname === "/admin/messages",
    },
    {
      name: "Reservations",
      href: "/admin/reservations",
      isActive: pathname === "/admin/reservations",
    },
    {
      name: "Tee Times",
      href: "/admin/tee-times",
      isActive: pathname === "/admin/tee-times",
    },
    {
      name: "Seasons",
      href: "/admin/seasons",
      isActive: pathname === "/admin/seasons",
    },
    {
      name: "Reset Password",
      href: "/admin/reset-password",
      isActive: pathname === "/admin/reset-password",
    },
  ]

  return (
    <div className={cn("flex space-x-1 overflow-x-auto", className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap",
            tab.isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          {tab.name}
        </Link>
      ))}
    </div>
  )
}
