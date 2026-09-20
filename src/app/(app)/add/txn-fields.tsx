"use client";

import { useMemo, useState } from "react";
import type { Account, Category, PaymentMethod } from "@/lib/types";
import { Avatar } from "@/components/ui";
import { cn, categoryClasses } from "@/lib/ui";
import { CATEGORY_COLORS, CATEGORY_COLOR_HEX, TITLE_MAX, type CategoryColor } from "@/lib/constants";
import { quickCreateCategory } from "@/actions/categories";
import { cycleContaining } from "@/lib/cycle";
import { formatDayShort } from "@/lib/dates";
import { DateFieldControl } from "@/components/date-picker";
import { SelectMenu } from "@/components/select-menu";

export function AmountInput({ defaultValue, autoFocus }: { defaultValue?: number; autoFocus?: boolean }) {
  return (
    <div className="flex items-center gap-2 h-14 px-4 rounded-inner bg-surface-raised border border-transparent">
      <span className="tnum text-2xl text-text-faint">₹</span>
      <input
        name="amount"
        type="number"
        min={1}
        inputMode="numeric"
        defaultValue={defaultValue}
        placeholder="0"
        autoFocus={autoFocus}
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
                // Chips are full-radius tinted pills (§1); press-scale on select (§8).
                "h-9 inline-flex items-center gap-2 px-3.5 rounded-full text-[13px] font-medium pressable",
                active
                  ? "bg-primary/15 text-primary font-semibold"
                  : "bg-surface-raised text-text-secondary",
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
    <div className="text-[12px] text-text-secondary bg-surface-raised border border-transparent rounded-control px-3 py-2">
      Goes to the credit-card ledger · cycle{" "}
      <span className="tnum">
        {formatDayShort(cycle.start)} – {formatDayShort(cycle.end)}
      </span>
    </div>
  );
}

export function DateField({ today, defaultValue }: { today: string; defaultValue?: string }) {
  return <DateFieldControl name="date" today={today} defaultValue={defaultValue} max={today} />;
}

/**
 * Title field with type-scoped suggestions. Picking a suggestion only fills this
 * form — it never edits other transactions.
 */
export function TitleInput({
  suggestions,
  defaultValue,
  placeholder,
  onPick,
}: {
  suggestions: string[];
  defaultValue?: string;
  placeholder?: string;
  /**
   * Fired when a title is chosen or typed to an exact past match, so the parent
   * can pre-fill the category/method the user last paired with it (P3).
   */
  onPick?: (title: string) => void;
}) {
  const [query, setQuery] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Only suggest after the user has typed something.
    if (!q) return [];
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      .slice(0, 8);
  }, [query, suggestions]);

  return (
    <div className="relative">
      <input
        name="title"
        maxLength={TITLE_MAX}
        autoComplete="off"
        defaultValue={defaultValue}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          setQuery(e.target.value);
          setOpen(e.target.value.trim().length > 0);
        }}
        onBlur={(e) => {
          // A typed-out exact match should infer just like a picked one.
          onPick?.(e.target.value);
          // Delay so a mousedown on a suggestion can fire first.
          window.setTimeout(() => setOpen(false), 120);
        }}
        className="h-10 w-full px-3 rounded-control bg-surface-raised border border-transparent outline-none text-[15px] text-text-primary placeholder:text-text-faint"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-auto rounded-control bg-surface border border-border py-1">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[14px] text-text-primary hover:bg-surface-raised pressable"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  const input = e.currentTarget
                    .closest(".relative")
                    ?.querySelector<HTMLInputElement>('input[name="title"]');
                  if (input) {
                    input.value = s;
                    setQuery(s);
                  }
                  onPick?.(s);
                  setOpen(false);
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
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
            "h-8 px-3 rounded-full text-[12.5px] font-medium pressable",
            selected === null ? "bg-surface-raised text-text-primary" : "text-text-faint",
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
                "h-8 px-3 rounded-full text-[12.5px] font-medium pressable",
                cc.pill,
                active ? "font-semibold" : "opacity-80",
              )}
            >
              {c.name}
            </button>
          );
        })}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="h-8 px-3 rounded-full text-[12.5px] font-medium bg-primary/10 text-primary pressable"
          >
            + New
          </button>
        )}
      </div>

      {adding && (
        <div className="flex flex-col gap-2 p-3 rounded-inner bg-surface-raised border border-transparent">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            className="h-9 px-3 rounded-control bg-surface border border-transparent outline-none text-[14px]"
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
  onChange,
}: {
  name: string;
  accounts: Account[];
  defaultId?: number | null;
  placeholder?: string;
  onChange?: (value: string) => void;
}) {
  const options = [
    ...(placeholder ? [{ value: "", label: placeholder }] : []),
    ...accounts.map((a) => ({ value: String(a.id), label: a.name })),
  ];
  return (
    <SelectMenu
      name={name}
      defaultValue={defaultId != null ? String(defaultId) : ""}
      options={options}
      placeholder={placeholder ?? "Select account"}
      onChange={onChange}
    />
  );
}
