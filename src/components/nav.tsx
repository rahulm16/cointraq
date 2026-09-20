"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Home,
  ListOrdered,
  ArrowLeftRight,
  SlidersHorizontal,
  Plus,
  Pin,
  PinOff,
  Moon,
  Sun,
  LogOut,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/ui";
import { APP_NAME } from "@/lib/constants";
import { CointraqLogo } from "@/components/cointraq-logo";
import { SPRING } from "@/lib/motion";
import { logout } from "@/actions/auth";
import { rememberAddReturnPath } from "@/lib/add-navigation";

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

/**
 * The desktop rail carries Budgets as well. The mobile dock stays at four
 * destinations plus the center action — a fifth icon there would squeeze the
 * 44px touch targets (§9), so on mobile Budgets is reached from its dashboard card.
 */
const railItems: NavItem[] = [
  items[0],
  items[1],
  { href: "/budgets", label: "Budgets", icon: Target },
  items[2],
  items[3],
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

const PIN_KEY = "cointraq-sidebar-pinned";

/* ------------------------------------------------------------------ */
/* Desktop: collapsible rail (§2) — Claude-style                       */
/* ------------------------------------------------------------------ */

export function Sidebar() {
  const pathname = usePathname();
  // Server and first client render agree on false; the real pinned state (already
  // painted via the pre-hydration html attribute + CSS) syncs in the effect below.
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(document.documentElement.hasAttribute("data-sidebar-pinned"));
  }, []);

  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      document.documentElement.toggleAttribute("data-sidebar-pinned", next);
      try {
        localStorage.setItem(PIN_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  // Collapsed = icons only; hover shows a tooltip with the page name.
  // Pin still expands the rail to show labels inline.
  const expanded = pinned;

  return (
    <Tooltip.Provider delayDuration={200} skipDelayDuration={0}>
      <aside
        data-expanded={expanded || undefined}
        className="rail hidden lg:flex fixed top-3 left-3 bottom-3 z-40 flex-col gap-2 overflow-hidden bg-surface rounded-card p-3 shadow-[var(--shadow-card)]"
      >
        {/* Logo + pin */}
        <div className="flex items-center h-10">
          <div className="w-11 flex-none flex justify-center">
            <div className="w-7 h-7 rounded-lg bg-primary/12 text-primary flex items-center justify-center">
              <CointraqLogo size={22} />
            </div>
          </div>
          <span className="rail-label text-[16px] font-semibold text-text-primary flex-1">{APP_NAME}</span>
          <button
            onClick={togglePin}
            aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            className="rail-when-expanded icon-btn w-8 h-8 rounded-full items-center justify-center text-text-faint flex-none"
          >
            {pinned ? <PinOff size={15} strokeWidth={1.75} /> : <Pin size={15} strokeWidth={1.75} />}
          </button>
        </div>

        {/* Add transaction — compact round button when collapsed */}
        <RailTooltip label="Add transaction" enabled={!expanded}>
          <Link
            href="/add"
            onClick={rememberAddReturnPath}
            aria-label="Add transaction"
            className={cn(
              "flex items-center justify-center bg-primary text-primary-contrast pressable rounded-full",
              expanded ? "h-10 w-full gap-2 px-3" : "size-8 mx-auto shrink-0",
            )}
          >
            <Plus size={16} strokeWidth={2.25} className="shrink-0" />
            {expanded && (
              <span className="text-[13.5px] font-semibold whitespace-nowrap">Add transaction</span>
            )}
          </Link>
        </RailTooltip>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 mt-1">
          {railItems.map((it, i) => {
            const active = isActive(pathname, it.href);
            const Icon = it.icon;
            return (
              <RailTooltip key={it.href} label={it.label} enabled={!expanded}>
                <Link
                  href={it.href}
                  aria-label={it.label}
                  className={cn(
                    "relative flex items-center h-10 rounded-control",
                    active ? "text-primary font-semibold" : "text-text-secondary font-medium hover:text-text-primary",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={SPRING}
                      className="absolute inset-0 rounded-control bg-primary/12"
                    />
                  )}
                  <span className="relative w-11 flex-none flex justify-center">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <span className="rail-label relative text-[13.5px]" style={{ "--stagger": i } as React.CSSProperties}>
                    {it.label}
                  </span>
                </Link>
              </RailTooltip>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Quiet utilities */}
        <div className="flex flex-col gap-0.5">
          <ThemeRailButton enabled={!expanded} />
          <RailTooltip label="Log out" enabled={!expanded}>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Log out"
                className="w-full flex items-center h-10 rounded-control text-text-faint hover:text-text-primary icon-btn"
              >
                <span className="w-11 flex-none flex justify-center">
                  <LogOut size={17} strokeWidth={1.75} />
                </span>
                <span className="rail-label text-[13px] font-medium">Log out</span>
              </button>
            </form>
          </RailTooltip>
        </div>
      </aside>
    </Tooltip.Provider>
  );
}

function ThemeRailButton({ enabled }: { enabled: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme === "dark";
  return (
    <RailTooltip label={dark ? "Light theme" : "Dark theme"} enabled={enabled}>
      <button
        onClick={() => setTheme(dark ? "light" : "dark")}
        aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        className="w-full flex items-center h-10 rounded-control text-text-faint hover:text-text-primary icon-btn"
      >
        <span className="w-11 flex-none flex justify-center">
          {dark ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
        </span>
        <span className="rail-label text-[13px] font-medium">{dark ? "Light theme" : "Dark theme"}</span>
      </button>
    </RailTooltip>
  );
}

/** Radix tooltip to the right of the icon — desktop collapsed rail only. */
function RailTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={12}
          className="z-50 px-2.5 py-1.5 rounded-[10px] bg-surface-overlay text-text-primary text-[12px] font-medium shadow-[var(--shadow-overlay)] select-none"
        >
          {label}
          <Tooltip.Arrow className="fill-surface-overlay" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile: floating dock (§3)                                          */
/* ------------------------------------------------------------------ */

export function Dock() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  // Hide on scroll down, reveal on any upward scroll. Paused while a drawer is open.
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      if (document.body.hasAttribute("data-drawer-open")) return;
      const y = window.scrollY;
      const dy = y - lastY;
      if (dy > 6 && y > 80) setHidden(true);
      else if (dy < -2) setHidden(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <div
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none"
      style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
    >
      <motion.nav
        animate={{ y: hidden ? "140%" : "0%" }}
        transition={SPRING}
        aria-label="Primary"
        className="pointer-events-auto flex items-center gap-1 h-16 px-2 rounded-full backdrop-blur-xl shadow-[var(--shadow-overlay)]"
        style={{ background: "var(--surface-glass)" }}
      >
        {left.map((it) => (
          <DockItem key={it.href} item={it} active={isActive(pathname, it.href)} />
        ))}
        <Link
          href="/add"
          onClick={rememberAddReturnPath}
          aria-label="Add transaction"
          className="w-14 h-14 mx-1 rounded-full bg-primary text-primary-contrast flex items-center justify-center shadow-[var(--shadow-hero)] pressable"
        >
          <Plus size={24} strokeWidth={2.25} />
        </Link>
        {right.map((it) => (
          <DockItem key={it.href} item={it} active={isActive(pathname, it.href)} />
        ))}
      </motion.nav>
    </div>
  );
}

function DockItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative w-12 h-12 rounded-full flex items-center justify-center",
        active ? "text-primary" : "text-text-faint",
      )}
    >
      {active && (
        <motion.span layoutId="dock-pill" transition={SPRING} className="absolute inset-0.5 rounded-full bg-primary/15" />
      )}
      <motion.span
        key={active ? "on" : "off"}
        initial={{ scale: active ? 0.9 : 1 }}
        animate={{ scale: 1 }}
        transition={SPRING}
        className="relative"
      >
        {/* lucide has no filled variants — active reads as bolder stroke + tint pill */}
        <Icon size={22} strokeWidth={active ? 2.4 : 1.75} />
      </motion.span>
    </Link>
  );
}
