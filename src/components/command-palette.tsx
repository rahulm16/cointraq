"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  ListOrdered,
  ArrowLeftRight,
  SlidersHorizontal,
  Plus,
  Search,
  Wallet,
  Target,
  type LucideIcon,
} from "lucide-react";
import { DUR, EASE, SPRING } from "@/lib/motion";
import { cn } from "@/lib/ui";
import { rememberAddReturnPath } from "@/lib/add-navigation";

/**
 * ⌘K palette. Keyboard-first navigation plus a passthrough to transaction search,
 * so the whole app is reachable without touching the rail.
 *
 * Rendered through a portal at the app shell so it sits above drawers.
 */

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: (router: ReturnType<typeof useRouter>) => void;
  keywords?: string;
}

const COMMANDS: Command[] = [
  { id: "home", label: "Dashboard", icon: Home, run: (r) => r.push("/"), keywords: "overview home" },
  { id: "add", label: "Add transaction", hint: "n", icon: Plus, run: (r) => r.push("/add"), keywords: "new spend log" },
  { id: "txns", label: "Transactions", icon: ListOrdered, run: (r) => r.push("/transactions"), keywords: "history list" },
  { id: "budgets", label: "Budgets", icon: Target, run: (r) => r.push("/budgets"), keywords: "cap limit" },
  { id: "reconcile", label: "Reconcile", icon: ArrowLeftRight, run: (r) => r.push("/reconcile"), keywords: "balance snapshot" },
  { id: "settings", label: "Settings", icon: SlidersHorizontal, run: (r) => r.push("/settings"), keywords: "accounts methods categories" },
  { id: "spend-add", label: "Log a spend", icon: Wallet, run: (r) => r.push("/add?kind=spend"), keywords: "expense" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setIndex(0);
  }, []);

  // Guard against a stale highlight pointing past a shrunken result list.
  const activeIndex = Math.min(index, Math.max(results.length - 1, 0));

  const runAt = useCallback(
    (i: number) => {
      const cmd = results[i];
      const q = query.trim();
      close();
      // A query with no command match falls through to transaction search.
      if (!cmd) {
        // Search every date — the Transactions page otherwise defaults to this month.
        if (q) router.push(`/transactions?q=${encodeURIComponent(q)}&all=1`);
        return;
      }
      if (cmd.id === "add" || cmd.id === "spend-add") rememberAddReturnPath();
      cmd.run(router);
    },
    [results, query, router, close],
  );

  // Global shortcuts. Single-key ones are ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        close();
        return;
      }

      if (open || mod) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;

      if (e.key === "n") {
        e.preventDefault();
        rememberAddReturnPath();
        router.push("/add");
      } else if (e.key === "/") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, router]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.fast, ease: EASE }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/40 backdrop-blur-[2px]"
          onClick={close}
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={SPRING}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="w-full max-w-[520px] rounded-[20px] bg-surface-overlay shadow-[var(--shadow-overlay)] overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-4 h-13 py-3.5">
              <Search size={16} strokeWidth={1.75} className="text-text-faint flex-none" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0); // a new query invalidates the old highlight
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    runAt(activeIndex);
                  }
                }}
                placeholder="Search or jump to…"
                aria-label="Search commands"
                className="flex-1 bg-transparent outline-none text-[14.5px] text-text-primary placeholder:text-text-faint"
              />
            </div>

            <div className="max-h-[46vh] overflow-y-auto px-2 pb-2">
              {results.length === 0 ? (
                <button
                  onClick={() => runAt(0)}
                  className="w-full flex items-center gap-3 px-2.5 h-11 rounded-control text-left bg-primary/10"
                >
                  <Search size={16} strokeWidth={1.75} className="text-primary" aria-hidden />
                  <span className="text-[13.5px] text-text-primary">
                    Search transactions for <span className="font-semibold">{query}</span>
                  </span>
                </button>
              ) : (
                results.map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => runAt(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-2.5 h-11 rounded-control text-left",
                        i === activeIndex ? "bg-primary/12" : "hover:bg-surface-raised",
                      )}
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.75}
                        className={i === activeIndex ? "text-primary" : "text-text-faint"}
                        aria-hidden
                      />
                      <span className="flex-1 text-[13.5px] text-text-primary">{c.label}</span>
                      {c.hint && (
                        <kbd className="text-[10.5px] font-medium text-text-faint bg-surface-raised px-1.5 py-0.5 rounded">
                          {c.hint}
                        </kbd>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
