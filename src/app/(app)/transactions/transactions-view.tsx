"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Account, Category, PaymentMethod, Transaction } from "@/lib/types";
import { Card, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { TxnRow } from "@/components/txn-row";
import { EditForm } from "./edit-form";
import { formatINR } from "@/lib/money";
import { formatDayLabel } from "@/lib/dates";
import { TYPE_LABEL } from "@/lib/txn-display";
import type { TransactionType } from "@/lib/types";
import { Search } from "lucide-react";

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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Type" value={filters.type ?? ""} onChange={(v) => setParam("type", v || undefined)}>
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Method" value={filters.methodId ? String(filters.methodId) : ""} onChange={(v) => setParam("method", v || undefined)}>
          <option value="">All methods</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Account" value={filters.accountId ? String(filters.accountId) : ""} onChange={(v) => setParam("account", v || undefined)}>
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Category" value={filters.categoryId ? String(filters.categoryId) : ""} onChange={(v) => setParam("category", v || undefined)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </FilterSelect>
      </div>

      {/* Summary line */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-control bg-surface-raised border border-transparent">
        <span className="text-[12.5px] tnum text-text-secondary">
          {summary.count} transaction{summary.count === 1 ? "" : "s"}
        </span>
        <span className="text-[12.5px] text-text-secondary">
          Spends <span className="tnum font-medium text-text-primary">{formatINR(summary.total)}</span>
        </span>
      </div>

      {/* Grouped list */}
      {transactions.length === 0 ? (
        <EmptyState title="No transactions" body="Nothing matches these filters this month." />
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([date, items]) => (
            <div key={date} className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-text-faint px-1">
                {formatDayLabel(date)}
              </div>
              <Card className="!p-0">
                <div className="px-4 divide-y divide-border">
                  {items.map((t) => (
                    <TxnRow
                      key={t.id}
                      txn={t}
                      accounts={accounts}
                      methods={methods}
                      categories={categories}
                      onClick={() => setEditing(t)}
                    />
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit transaction">
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
      </Sheet>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-2.5 rounded-control bg-surface border border-transparent text-[12.5px] text-text-secondary outline-none focus:border-primary"
    >
      {children}
    </select>
  );
}
