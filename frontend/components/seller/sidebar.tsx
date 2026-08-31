"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, Package, Users, Boxes, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; exact: boolean }[] = [
  { href: "/seller", label: "Boshqaruv paneli", icon: LayoutDashboard, exact: true },
  { href: "/seller/orders", label: "Buyurtmalar", icon: ClipboardList, exact: false },
  { href: "/seller/products", label: "Mahsulotlar", icon: Package, exact: false },
  { href: "/seller/customers", label: "Mijozlar", icon: Users, exact: false },
  { href: "/seller/inventory", label: "Ombor", icon: Boxes, exact: false },
  { href: "/seller/profile", label: "Profil", icon: User, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <p className="seller-eyebrow text-accent">Diesel Parts</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent-subtle text-accent" : "text-muted hover:bg-surface-hover hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
