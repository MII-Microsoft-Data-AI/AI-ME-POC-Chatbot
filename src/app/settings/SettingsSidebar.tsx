'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: '/settings/general', label: 'General' },
  { href: '/settings/personalization', label: 'Personalization' },
  { href: '/settings/resources', label: 'Resources' },
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/privacy', label: 'Privacy' },
  { href: '/settings/billing', label: 'Billing' },
  { href: '/settings/capabilities', label: 'Capabilities' },
  { href: '/settings/connectors', label: 'Connectors' },
]

export default function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-full md:w-64 flex-shrink-0 sticky top-6 self-start">
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-left px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 block",
              pathname === item.href || pathname?.startsWith(item.href + '/')
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
