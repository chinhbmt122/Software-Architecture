"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  {
    label: "Thể loại",
    href: "/novels",
    active: (p: string, sp: URLSearchParams) =>
      p === "/novels" && !sp.has("sort") && sp.get("status") !== "COMPLETED",
  },
  {
    label: "Bảng xếp hạng",
    href: "/novels?sort=trending",
    // active for any ranking sort tab (trending / rating / chapters)
    active: (p: string, sp: URLSearchParams) => p === "/novels" && sp.has("sort"),
  },
  {
    label: "Hoàn thành",
    href: "/novels?status=COMPLETED",
    active: (p: string, sp: URLSearchParams) =>
      p === "/novels" && sp.get("status") === "COMPLETED",
  },
]

export function NavLinks() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <>
      {NAV_LINKS.map((link) => {
        const isActive = link.active(pathname, searchParams)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              isActive
                ? "text-foreground font-medium bg-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </>
  )
}
