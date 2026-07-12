"use client";

import { useState } from "react";
import type { Account, Category, PaymentMethod } from "@/lib/types";
import { Avatar } from "@/components/ui";
import { cn, categoryClasses } from "@/lib/ui";
import { CATEGORY_COLORS, CATEGORY_COLOR_HEX, type CategoryColor } from "@/lib/constants";
import { quickCreateCategory } from "@/actions/categories";
import { cycleContaining } from "@/lib/cycle";
import { formatDayShort } from "@/lib/dates";
import { subDays } from "date-fns";
import { parseDate, toDateStr } from "@/lib/dates";

export function AmountInput({ defaultValue }: { defaultValue?: number }) {
  return (
    <div className="flex items-center gap-2 h-14 px-4 rounded-inner bg-surface-raised border border-border focus-within:border-primary">
      <span className="tnum text-2xl text-text-faint">₹</span>
      <input
        name="amount"
        type="number"
        min={1}
        inputMode="numeric"
        defaultValue={defaultValue}
        placeholder="0"
        autoFocus
        className="flex-1 bg-transparent outline-none tnum text-3xl text-text-primary placeholder:text-text-faint w-full"
      />
    </div>
  );
}

/** Method chips. Selecting a CC-linked method surfaces a hint via onCcChange. */
export function MethodChips({
  methods,
  accounts,
  defaultId,
  onSelect,
}: {
  methods: PaymentMethod[];
  accounts: Account[];
  defaultId: number | null;
  onSelect?: (m: PaymentMethod | null) => void;
}) {
  const [selected, setSelected] = useState<number | null>(defaultId);
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="methodId" value={selected ?? ""} />
      <div className="flex flex-wrap gap-2">
        {methods.map((m) => {
          const active = selected === m.id;
          const isCard = accounts.find((a) => a.id === m.accountId)?.type === "credit_card";
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSelected(m.id);
                onSelect?.(m);
              }}
              className={cn(
                "h-9 inline-flex items-center gap-2 px-3.5 rounded-control border text-[13px] font-medium",
                active
                  ? "bg-primary/12 border-primary/40 text-primary font-semibold"
                  : "bg-surface border-border text-text-secondary",
              )}
            >
              <Avatar icon={m.icon} name={m.name} size={20} />
              {m.name}
              {isCard && <span className="text-[10px] text-text-faint">CC</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Cycle hint shown when a credit-card method is chosen on the Spend tab. */
export function CcHint({ billingDay, date }: { billingDay: number; date: string }) {
  const cycle = cycleContaining(date, billingDay);
  return (
    <div className="text-[12px] text-text-secondary bg-surface-raised border border-border rounded-control px-3 py-2">
      Goes to the credit-card ledger · cycle{" "}
      <span className="tnum">
        {formatDayShort(cycle.start)} – {formatDayShort(cycle.end)}
      </span>
    </div>
  );
}

export function DateField({ today, defaultValue }: { today: string; defaultValue?: string }) {
  const [date, setDate] = useState(defaultValue ?? today);
  const yesterday = toDateStr(subDays(parseDate(today), 1));
  return (
    <div className="flex items-center gap-2">
      <input
        name="date"
        type="date"
        value={date}
        max={today}
        onChange={(e) => setDate(e.target.value)}
        className="h-10 px-3 rounded-control bg-surface-raised border border-border outline-none text-[15px] tnum text-text-primary focus:border-primary"
      />
      <button
        type="button"
        onClick={() => setDate(today)}
        className={cn(
          "h-9 px-3 rounded-control border text-[12.5px] font-medium",
          date === today ? "bg-primary/12 border-primary/40 text-primary" : "bg-surface border-border text-text-secondary",
        )}
      >
        Today
      </button>
      <button
        type="button"
        onClick={() => setDate(yesterday)}
        className={cn(
          "h-9 px-3 rounded-control border text-[12.5px] font-medium",
          date === yesterday ? "bg-primary/12 border-primary/40 text-primary" : "bg-surface border-border text-text-secondary",
        )}
      >
        Yesterday
      </button>
    </div>
  );
}

/** Category picker with inline "+ New" that creates via server action. */
export function CategoryPicker({
  categories: initial,
  defaultId,
}: {
  categories: Category[];
  defaultId?: number | null;
}) {
  const [categories, setCategories] = useState(initial);
  const [selected, setSelected] = useState<number | null>(defaultId ?? null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<CategoryColor>("blue");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!newName.trim()) return;
    setBusy(true);
    const res = await quickCreateCategory(newName.trim(), newColor);
    setBusy(false);
    if (res.ok && res.id) {
      const added: Category = {
        id: res.id,
        name: newName.trim(),
        color: newColor,
        isArchived: false,
        createdAt: new Date(),
      };
      setCategories((c) => [...c, added]);
      setSelected(res.id);
      setAdding(false);
      setNewName("");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="categoryId" value={selected ?? ""} />
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className={cn(
            "h-8 px-3 rounded-full text-[12.5px] font-medium border",
            selected === null ? "border-text-primary text-text-primary" : "border-border text-text-faint",
          )}
        >
          None
        </button>
        {categories.map((c) => {
          const cc = categoryClasses(c.color);
          const active = selected === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c.id)}
              className={cn(
                "h-8 px-3 rounded-full text-[12.5px] font-medium",
                cc.pill,
                active && "ring-2 ring-offset-1 ring-offset-surface",
              )}
              style={active ? { boxShadow: `0 0 0 2px ${CATEGORY_COLOR_HEX[c.color].solid}` } : undefined}
            >
              {c.name}
            </button>
          );
        })}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="h-8 px-3 rounded-full text-[12.5px] font-medium border border-dashed border-border text-primary"
          >
            + New
          </button>
        )}
      </div>

      {adding && (
        <div className="flex flex-col gap-2 p-3 rounded-inner bg-surface-raised border border-border">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            className="h-9 px-3 rounded-control bg-surface border border-border outline-none text-[14px] focus:border-primary"
          />
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={cn("w-7 h-7 rounded-full border-2", newColor === c ? "border-text-primary" : "border-transparent")}
                style={{ background: CATEGORY_COLOR_HEX[c].solid }}
                aria-label={c}
              />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)} className="h-8 px-3 text-[13px] text-text-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="h-8 px-3 rounded-control bg-primary text-primary-contrast text-[13px] font-semibold disabled:opacity-60"
            >
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Account select used by transfer/withdrawal/income/bill_pay. */
export function AccountSelect({
  name,
  accounts,
  defaultId,
  placeholder,
}: {
  name: string;
  accounts: Account[];
  defaultId?: number | null;
  placeholder?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultId ?? ""}
      className="h-10 px-3 rounded-control bg-surface-raised border border-border outline-none text-[15px] text-text-primary focus:border-primary w-full"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}
