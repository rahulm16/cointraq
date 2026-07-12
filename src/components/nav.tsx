"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui";
import { APP_NAME } from "@/lib/constants";
import { Home, ListOrdered, ArrowLeftRight, SlidersHorizontal, Plus, type LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const items: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/transactions", label: "Transactions", icon: ListOrdered },
  { href: "/reconcile", label: "Reconcile", icon: ArrowLeftRight },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Bottom nav for < 1024px. Add button in the center. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 h-[72px] bg-surface border-t border-border grid grid-cols-5 items-center pb-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.18)] z-40">
      <NavCell item={items[0]} active={isActive(pathname, items[0].href)} />
      <NavCell item={items[1]} active={isActive(pathname, items[1].href)} />
      <div className="flex items-center justify-center">
        <Link
          href="/add"
          aria-label="Add transaction"
          className="w-[52px] h-[52px] rounded-full bg-primary text-primary-contrast flex items-center justify-center -mt-8 border-4 border-surface"
        >
          <Plus size={24} strokeWidth={2} />
        </Link>
      </div>
      <NavCell item={items[2]} active={isActive(pathname, items[2].href)} />
      <NavCell item={items[3]} active={isActive(pathname, items[3].href)} />
    </nav>
  );
}

function NavCell({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn("flex flex-col items-center gap-1", active ? "text-primary" : "text-text-faint")}
    >
      <Icon size={22} strokeWidth={1.75} />
      <span className="text-[10px] font-medium">{item.label}</span>
    </Link>
  );
}

/**
 * Floating fixed sidebar for >= 1024px (Claude-desktop style): pinned to the
 * viewport, insets from the edges so it reads as a floating panel, and stays put
 * while the page content scrolls.
 */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex fixed top-3 left-3 bottom-3 w-[224px] z-30 flex-col gap-5 bg-surface border border-transparent rounded-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5 px-1.5 py-0.5">
        <div className="w-7 h-7 rounded-lg bg-primary text-primary-contrast flex items-center justify-center font-semibold text-sm">
          {APP_NAME.charAt(0).toUpperCase()}
        </div>
        <div className="text-[17px] font-semibold text-text-primary">{APP_NAME}</div>
      </div>

      <Link
        href="/add"
        className="flex items-center justify-center gap-2 h-10 rounded-control bg-primary text-primary-contrast font-semibold text-[13.5px]"
      >
        <Plus size={16} strokeWidth={2} />
        Add transaction
      </Link>

      <div className="flex flex-col gap-0.5">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 h-10 px-3 rounded-control transition-colors",
                active
                  ? "bg-primary/12 text-primary font-semibold"
                  : "text-text-secondary font-medium hover:bg-surface-raised",
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="text-[13.5px]">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
