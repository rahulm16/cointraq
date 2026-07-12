"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Account, Category, PaymentMethod, Transaction } from "@/lib/types";
import { Card, EmptyState } from "@/components/ui";
import { AppDrawer } from "@/components/drawer";
import { ConfirmDialog } from "@/components/sheet";
import { TxnRow } from "@/components/txn-row";
import { EditForm } from "./edit-form";
import { deleteTransaction } from "@/actions/transactions";
import { INRFlow } from "@/components/inr-flow";
import { formatDayLabel } from "@/lib/dates";
import { DUR, fadeTransition } from "@/lib/motion";
import { TYPE_LABEL } from "@/lib/txn-display";
import { cn } from "@/lib/ui";
import type { TransactionType } from "@/lib/types";
import { Search, Filter, Wallet, Landmark, Tag, ChevronDown, type LucideIcon } from "lucide-react";

const TYPES: TransactionType[] = ["expense", "cc_spend", "bill_pay", "transfer", "withdrawal", "income"];

export function TransactionsView({
  transactions,
  accounts,
  methods,
  categories,
  summary,
  today,
  filters,
}: {
  transactions: Transaction[];
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  summary: { count: number; total: number; heroCount: number };
  today: string;
  filters: {
    type?: string;
    methodId?: number;
    categoryId?: number;
    accountId?: number;
    search?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [confirming, setConfirming] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchText, setSearchText] = useState(filters.search ?? "");

  function setParam(key: string, value: string | undefined) {
    const p = new URLSearchParams(params.toString());
    if (value === undefined || value === "") p.delete(key);
    else p.set(key, value);
    router.push(`${pathname}?${p.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setParam("q", searchText || undefined);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [transactions]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <form onSubmit={submitSearch} className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-control bg-surface-raised border border-transparent focus-within:border-primary">
          <Search size={16} strokeWidth={1.5} className="text-text-faint" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search notes"
            className="flex-1 bg-transparent outline-none text-[14px] text-text-primary placeholder:text-text-faint"
          />
          {searchText && (
            <button type="button" onClick={() => { setSearchText(""); setParam("q", undefined); }} className="text-text-faint text-[13px]">
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Filters — icon chips that light up + show a dot when active (§7) */}
      <div className="flex flex-wrap gap-2">
        <FilterChip icon={Filter} label="Type" active={!!filters.type} value={filters.type ?? ""} onChange={(v) => setParam("type", v || undefined)}>
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </FilterChip>
        <FilterChip icon={Wallet} label="Method" active={!!filters.methodId} value={filters.methodId ? String(filters.methodId) : ""} onChange={(v) => setParam("method", v || undefined)}>
          <option value="">All methods</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </FilterChip>
        <FilterChip icon={Landmark} label="Account" active={!!filters.accountId} value={filters.accountId ? String(filters.accountId) : ""} onChange={(v) => setParam("account", v || undefined)}>
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </FilterChip>
        <FilterChip icon={Tag} label="Category" active={!!filters.categoryId} value={filters.categoryId ? String(filters.categoryId) : ""} onChange={(v) => setParam("category", v || undefined)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </FilterChip>
      </div>

      {/* Summary line */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-control bg-surface-raised border border-transparent">
        <span className="text-[12.5px] tnum text-text-secondary">
          {summary.count} transaction{summary.count === 1 ? "" : "s"}
        </span>
        <span className="text-[12.5px] text-text-secondary">
          Spends{" "}
          <span className="font-medium text-text-primary">
            <INRFlow value={summary.total} />
          </span>
        </span>
      </div>

      {/* Grouped list */}
      {transactions.length === 0 ? (
        <EmptyState title="No transactions" body="Nothing matches these filters this month." />
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([date, items]) => (
            <div key={date} className="flex flex-col gap-1">
              {/* Sticky date header — elevates with a blur when it sticks (§8). */}
              <div className="sticky top-0 z-10 -mx-1 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-text-faint bg-background/70 backdrop-blur-md rounded-lg">
                {formatDayLabel(date)}
              </div>
              <Card className="!p-0">
                <div className="px-4">
                  <AnimatePresence initial={false}>
                    {items.map((t) => (
                      <motion.div
                        key={t.id}
                        layout
                        exit={{ height: 0, opacity: 0 }}
                        transition={fadeTransition(DUR.base)}
                        className="overflow-hidden border-b border-border last:border-0"
                      >
                        <TxnRow
                          txn={t}
                          accounts={accounts}
                          methods={methods}
                          categories={categories}
                          onClick={() => setEditing(t)}
                          onDelete={() => setConfirming(t)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      <AppDrawer open={!!editing} onClose={() => setEditing(null)} title="Edit transaction">
        {editing && (
          <EditForm
            txn={editing}
            accounts={accounts}
            methods={methods}
            categories={categories}
            today={today}
            onDone={() => setEditing(null)}
          />
        )}
      </AppDrawer>

      <ConfirmDialog
        open={!!confirming}
        title="Delete this transaction?"
        body="This permanently removes it. Balances will recompute."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={async () => {
          if (!confirming) return;
          setDeleting(true);
          await deleteTransaction(confirming.id);
          setDeleting(false);
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}

function FilterChip({
  icon: Icon,
  label,
  value,
  active,
  onChange,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  active: boolean;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  // Native select stays for accessibility (full text in the open dropdown),
  // overlaid transparently on a chip that shows the icon + active dot.
  return (
    <div
      className={cn(
        "relative h-9 inline-flex items-center gap-1.5 pl-3 pr-2.5 rounded-full text-[12.5px] font-medium pressable",
        active ? "bg-primary/12 text-primary" : "bg-surface-raised text-text-secondary",
      )}
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden />
      <span>{label}</span>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />}
      <ChevronDown size={13} strokeWidth={1.75} className="opacity-60" aria-hidden />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        {children}
      </select>
    </div>
  );
}
