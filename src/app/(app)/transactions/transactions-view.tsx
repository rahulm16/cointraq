"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Account, Category, PaymentMethod, Transaction } from "@/lib/types";
import type { TitlesByKind } from "@/lib/txn-display";
import { Card, EmptyState } from "@/components/ui";
import { AppDrawer } from "@/components/drawer";
import { ConfirmDialog } from "@/components/sheet";
import { TxnRow } from "@/components/txn-row";
import { EditForm } from "./edit-form";
import { deleteTransactionWithUndo, restoreTransaction } from "@/actions/transactions";
import { useToast } from "@/components/toast";
import { INRFlow } from "@/components/inr-flow";
import { formatDayLabel } from "@/lib/dates";
import { DUR, fadeTransition } from "@/lib/motion";
import { TYPE_LABEL } from "@/lib/txn-display";
import { cn } from "@/lib/ui";
import type { TransactionType } from "@/lib/types";
import { Search, Filter, Wallet, Landmark, Tag, ChevronDown, Check, type LucideIcon } from "lucide-react";
import { BulkBar } from "./bulk-bar";
import { SelectMenu, type SelectOption } from "@/components/select-menu";

const TYPES: TransactionType[] = ["expense", "cc_spend", "bill_pay", "transfer", "withdrawal", "income"];

const CHROME =
  "bg-surface text-text-primary shadow-[var(--shadow-card)]";

export function TransactionsView({
  transactions,
  accounts,
  methods,
  categories,
  summary,
  today,
  titlesByKind,
  filters,
  queryLabel,
}: {
  transactions: Transaction[];
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  summary: { count: number; total: number; heroCount: number };
  today: string;
  titlesByKind: TitlesByKind;
  filters: {
    type?: string;
    methodId?: number;
    categoryId?: number;
    accountId?: number;
    search?: string;
  };
  /** Human description of the parsed search ("₹100–₹500"), if any. */
  queryLabel?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [confirming, setConfirming] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { show } = useToast();

  // Bulk selection. Entering select mode swaps row taps from "edit" to "select".
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  // A filter or search change shows different rows, and this component isn't
  // remounted for it — a selection made on the old list must not carry over.
  const filterKey = params.toString();
  const [selectionKey, setSelectionKey] = useState(filterKey);
  if (selectionKey !== filterKey) {
    setSelectionKey(filterKey);
    setSelected([]);
    setSelectMode(false);
  }
  // And only ever act on rows that are actually on screen.
  const visibleIds = useMemo(() => new Set(transactions.map((t) => t.id)), [transactions]);
  const actionable = selected.filter((id) => visibleIds.has(id));

  const toggleSelect = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const exitSelect = () => {
    setSelectMode(false);
    setSelected([]);
  };
  const [searchText, setSearchText] = useState(filters.search ?? "");

  function setParam(key: string, value: string | undefined) {
    const p = new URLSearchParams(params.toString());
    if (value === undefined || value === "") p.delete(key);
    else p.set(key, value);
    // Clearing the search also ends an "all dates" search from the command palette.
    if (key === "q" && !value) p.delete("all");
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
      <form onSubmit={submitSearch} className="flex gap-2">
        <div className={cn("flex-1 flex items-center gap-2 h-10 px-3 rounded-control", CHROME)}>
          <Search size={16} strokeWidth={1.5} className="text-text-secondary" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search titles"
            className="flex-1 bg-transparent outline-none text-[14px] text-text-primary placeholder:text-text-secondary"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => {
                setSearchText("");
                setParam("q", undefined);
              }}
              className="text-text-secondary text-[13px] font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          icon={Filter}
          label="Type"
          active={!!filters.type}
          value={filters.type ?? ""}
          options={[
            { value: "", label: "All types" },
            ...TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
          ]}
          onChange={(v) => setParam("type", v || undefined)}
        />
        <FilterChip
          icon={Wallet}
          label="Method"
          active={!!filters.methodId}
          value={filters.methodId ? String(filters.methodId) : ""}
          options={[
            { value: "", label: "All methods" },
            ...methods.map((m) => ({ value: String(m.id), label: m.name })),
          ]}
          onChange={(v) => setParam("method", v || undefined)}
        />
        <FilterChip
          icon={Landmark}
          label="Account"
          active={!!filters.accountId}
          value={filters.accountId ? String(filters.accountId) : ""}
          options={[
            { value: "", label: "All accounts" },
            ...accounts.map((a) => ({ value: String(a.id), label: a.name })),
          ]}
          onChange={(v) => setParam("account", v || undefined)}
        />
        <FilterChip
          icon={Tag}
          label="Category"
          active={!!filters.categoryId}
          value={filters.categoryId ? String(filters.categoryId) : ""}
          options={[
            { value: "", label: "All categories" },
            ...categories.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
          onChange={(v) => setParam("category", v || undefined)}
        />
      </div>

      <div className={cn("flex items-center justify-between px-3 py-2.5 rounded-control", CHROME)}>
        <span className="text-[12.5px] tnum font-medium text-text-primary">
          {summary.count} transaction{summary.count === 1 ? "" : "s"}
          {queryLabel && <span className="font-normal text-text-secondary"> · {queryLabel}</span>}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] font-medium text-text-primary">
            Spends{" "}
            <span className="tnum font-semibold">
              <INRFlow value={summary.total} />
            </span>
          </span>
          {transactions.length > 0 && (
            <button
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              className="text-[12px] font-semibold text-text-faint hover:text-text-primary"
            >
              {selectMode ? "Done" : "Select"}
            </button>
          )}
        </div>
      </div>

      {transactions.length === 0 ? (
        <EmptyState title="No transactions" body="Nothing matches these filters in this period." />
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([date, items]) => (
            <div key={date} className="flex flex-col gap-1">
              <div className="sticky top-[68px] z-10 -mx-1 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-text-faint bg-background/70 backdrop-blur-md rounded-lg">
                {formatDayLabel(date)}
              </div>
              <Card className="!p-0 overflow-hidden">
                <AnimatePresence initial={false}>
                  {items.map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      exit={{ height: 0, opacity: 0 }}
                      transition={fadeTransition(DUR.base)}
                      className="border-b border-border last:border-b-0"
                    >
                      <div className="flex items-center">
                        {selectMode && (
                          <button
                            onClick={() => toggleSelect(t.id)}
                            role="checkbox"
                            aria-checked={selected.includes(t.id)}
                            aria-label={`Select ${t.title}`}
                            className="flex-none pl-3 pr-1 self-stretch flex items-center"
                          >
                            <span
                              className={cn(
                                "size-[18px] rounded-md flex items-center justify-center",
                                selected.includes(t.id)
                                  ? "bg-primary text-primary-contrast"
                                  : "bg-surface-raised",
                              )}
                            >
                              {selected.includes(t.id) && <Check size={12} strokeWidth={3} />}
                            </span>
                          </button>
                        )}
                        <div className="min-w-0 flex-1">
                          <TxnRow
                            txn={t}
                            accounts={accounts}
                            methods={methods}
                            categories={categories}
                            onClick={() => (selectMode ? toggleSelect(t.id) : setEditing(t))}
                            onDelete={() => setConfirming(t)}
                            className="border-b-0"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
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
            titlesByKind={titlesByKind}
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
          const res = await deleteTransactionWithUndo(confirming.id);
          setDeleting(false);
          setConfirming(null);

          // Undo re-inserts the captured row; the toast is the whole undo window.
          if (res.ok && res.restore) {
            const snapshot = res.restore;
            show("Deleted", {
              action: {
                label: "Undo",
                onClick: () => {
                  void restoreTransaction(snapshot).then((r) => {
                    if (!r.ok) show("Could not undo", { tone: "error" });
                  });
                },
              },
            });
          }
        }}
        onCancel={() => setConfirming(null)}
      />

      <BulkBar selected={actionable} categories={categories} onClear={exitSelect} />
    </div>
  );
}

function FilterChip({
  icon: Icon,
  label,
  value,
  active,
  options,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  active: boolean;
  options: SelectOption[];
  onChange: (v: string) => void;
}) {
  return (
    <SelectMenu
      value={value}
      options={options}
      onChange={onChange}
      renderTrigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={label}
          aria-expanded={open}
          className={cn(
            "h-9 inline-flex items-center gap-1.5 pl-3 pr-2.5 rounded-full text-[12.5px] font-semibold pressable transition-colors",
            open
              ? "bg-primary text-primary-contrast shadow-[var(--shadow-card)]"
              : active
                ? "bg-primary/15 text-primary"
                : CHROME,
          )}
        >
          <Icon size={14} strokeWidth={1.75} aria-hidden />
          <span>{label}</span>
          {active && (
            <span
              className={cn("w-1.5 h-1.5 rounded-full", open ? "bg-primary-contrast" : "bg-primary")}
              aria-hidden
            />
          )}
          <ChevronDown
            size={13}
            strokeWidth={1.75}
            className={cn("opacity-60 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      )}
    />
  );
}
