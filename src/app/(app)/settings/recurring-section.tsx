"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Pause, Play, Repeat } from "lucide-react";
import type { Account, Category, PaymentMethod, RecurringTemplate } from "@/lib/types";
import {
  createRecurring,
  updateRecurring,
  deleteRecurring,
  setRecurringArchived,
} from "@/actions/recurring";
import type { ActionResult } from "@/actions/shared";
import { describeSchedule, allWithState } from "@/lib/recurring";
import { formatINR } from "@/lib/money";
import { formatDayShort } from "@/lib/dates";
import { Card, Eyebrow, StatusBadge } from "@/components/ui";
import { AppDrawer } from "@/components/drawer";
import { ConfirmDialog } from "@/components/sheet";
import { Field, TextInput } from "@/components/form";
import { SelectMenu } from "@/components/select-menu";
import { useToast } from "@/components/toast";
import { categoryClasses, cn } from "@/lib/ui";

/**
 * Recurring template manager. These are reminders, not automation — the copy
 * says so explicitly, because "recurring" in most finance apps means auto-posted
 * entries and this deliberately doesn't.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TYPE_OPTIONS = [
  { value: "expense", label: "Spend" },
  { value: "bill_pay", label: "Bill payment" },
  { value: "transfer", label: "Transfer" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "income", label: "Income" },
];

export function RecurringSection({
  templates,
  accounts,
  methods,
  categories,
  today,
}: {
  templates: RecurringTemplate[];
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  today: string;
}) {
  const [editing, setEditing] = useState<RecurringTemplate | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<RecurringTemplate | null>(null);
  const [pending, startTransition] = useTransition();
  const { show } = useToast();

  const rows = allWithState(templates, today);
  const active = rows.filter((r) => !r.template.isArchived);
  const paused = rows.filter((r) => r.template.isArchived);

  const toggleArchive = (t: RecurringTemplate) => {
    startTransition(async () => {
      const res = await setRecurringArchived(t.id, !t.isArchived);
      show(res.message ?? "Updated", { tone: res.ok ? "success" : "error" });
    });
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Repeat size={12} strokeWidth={2} className="text-text-faint" aria-hidden />
          <Eyebrow>Recurring</Eyebrow>
        </div>
        <button
          onClick={() => setAdding(true)}
          aria-label="Add recurring"
          className="icon-btn size-8 rounded-full flex items-center justify-center text-text-secondary"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>

      <p className="text-[12px] text-text-faint mt-1.5 leading-relaxed">
        Reminders for repeating spends. Nothing is logged automatically — due items
        appear on the dashboard for you to confirm.
      </p>

      {rows.length === 0 ? (
        <button
          onClick={() => setAdding(true)}
          className="w-full mt-3 h-11 rounded-control bg-surface-raised text-[13px] font-medium text-text-secondary"
        >
          Add your first recurring item
        </button>
      ) : (
        <div className="flex flex-col divide-y divide-hairline mt-2">
          {[...active, ...paused].map(({ template: t, dueDate, state }) => {
            const cat = categories.find((c) => c.id === t.categoryId);
            return (
              <div key={t.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "text-[13.5px] font-medium truncate",
                        t.isArchived ? "text-text-faint" : "text-text-primary",
                      )}
                    >
                      {t.title}
                    </span>
                    <span className="text-[12.5px] tnum text-text-secondary flex-none">
                      {formatINR(t.amount)}
                    </span>
                    {state === "overdue" && !t.isArchived && <StatusBadge tone="alert">Overdue</StatusBadge>}
                    {t.isArchived && <StatusBadge tone="faint">Paused</StatusBadge>}
                  </div>
                  <div className="text-[11.5px] text-text-faint mt-0.5">
                    {describeSchedule(t)}
                    {!t.isArchived && <> · next {formatDayShort(dueDate)}</>}
                    {cat && <span className={cn("ml-1", categoryClasses(cat.color).text)}>· {cat.name}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 flex-none">
                  <button
                    onClick={() => toggleArchive(t)}
                    disabled={pending}
                    aria-label={t.isArchived ? `Resume ${t.title}` : `Pause ${t.title}`}
                    className="icon-btn size-8 rounded-full flex items-center justify-center text-text-faint"
                  >
                    {t.isArchived ? <Play size={14} strokeWidth={2} /> : <Pause size={14} strokeWidth={2} />}
                  </button>
                  <button
                    onClick={() => setEditing(t)}
                    aria-label={`Edit ${t.title}`}
                    className="icon-btn size-8 rounded-full flex items-center justify-center text-text-faint"
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => setConfirming(t)}
                    aria-label={`Delete ${t.title}`}
                    className="icon-btn size-8 rounded-full flex items-center justify-center text-text-faint hover:text-alert"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AppDrawer
        open={adding || !!editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        title={editing ? "Edit recurring" : "New recurring"}
      >
        <RecurringForm
          template={editing}
          accounts={accounts}
          methods={methods}
          categories={categories}
          onDone={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      </AppDrawer>

      <ConfirmDialog
        open={!!confirming}
        title="Delete this recurring item?"
        body="Transactions already logged from it are not affected."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!confirming) return;
          const res = await deleteRecurring(confirming.id);
          show(res.message ?? "Deleted", { tone: res.ok ? "success" : "error" });
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  );
}

const initial: ActionResult = { ok: false };

function RecurringForm({
  template,
  accounts,
  methods,
  categories,
  onDone,
}: {
  template: RecurringTemplate | null;
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  onDone: () => void;
}) {
  const action = template ? updateRecurring : createRecurring;
  const [state, formAction, pending] = useActionState(action, initial);
  const [type, setType] = useState(template?.type ?? "expense");
  const [recurrence, setRecurrence] = useState(template?.recurrence ?? "monthly");
  const { show } = useToast();

  useEffect(() => {
    if (state.ok) {
      show(state.message ?? "Saved", { tone: "success" });
      onDone();
    }
  }, [state, show, onDone]);

  const nonCredit = accounts.filter((a) => a.type !== "credit_card");
  const cards = accounts.filter((a) => a.type === "credit_card");
  const banks = accounts.filter((a) => a.type === "bank");
  const isSpend = type === "expense";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {template && <input type="hidden" name="id" value={template.id} />}

      <Field label="Title" error={state.errors?.title}>
        <TextInput name="title" defaultValue={template?.title} placeholder="Rent" maxLength={200} />
      </Field>

      <Field label="Amount" error={state.errors?.amount}>
        <TextInput
          name="amount"
          numeric
          inputMode="numeric"
          defaultValue={template?.amount}
          placeholder="25000"
        />
      </Field>

      <Field label="Type">
        <SelectMenu
          name="type"
          value={type}
          options={TYPE_OPTIONS}
          onChange={(v) => setType(v as RecurringTemplate["type"])}
        />
      </Field>

      {isSpend && (
        <>
          <Field label="Method" error={state.errors?.methodId}>
            <SelectMenu
              name="methodId"
              defaultValue={String(template?.methodId ?? methods.find((m) => m.isDefault)?.id ?? "")}
              options={methods.map((m) => ({ value: String(m.id), label: m.name }))}
            />
          </Field>
          <Field label="Category (optional)">
            <SelectMenu
              name="categoryId"
              defaultValue={String(template?.categoryId ?? "none")}
              options={[
                { value: "none", label: "None" },
                ...categories.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
            />
          </Field>
        </>
      )}

      {type === "bill_pay" && (
        <>
          <Field label="Pay from method" error={state.errors?.methodId}>
            <SelectMenu
              name="methodId"
              defaultValue={String(template?.methodId ?? "")}
              options={methods
                .filter((m) => accounts.find((a) => a.id === m.accountId)?.type !== "credit_card")
                .map((m) => ({ value: String(m.id), label: m.name }))}
            />
          </Field>
          <Field label="Credit card" error={state.errors?.toAccountId}>
            <SelectMenu
              name="toAccountId"
              defaultValue={String(template?.toAccountId ?? cards[0]?.id ?? "")}
              options={cards.map((a) => ({ value: String(a.id), label: a.name }))}
            />
          </Field>
        </>
      )}

      {type === "transfer" && (
        <>
          <Field label="From" error={state.errors?.fromAccountId}>
            <SelectMenu
              name="fromAccountId"
              defaultValue={String(template?.fromAccountId ?? nonCredit[0]?.id ?? "")}
              options={nonCredit.map((a) => ({ value: String(a.id), label: a.name }))}
            />
          </Field>
          <Field label="To" error={state.errors?.toAccountId}>
            <SelectMenu
              name="toAccountId"
              defaultValue={String(template?.toAccountId ?? nonCredit[1]?.id ?? "")}
              options={nonCredit.map((a) => ({ value: String(a.id), label: a.name }))}
            />
          </Field>
        </>
      )}

      {type === "withdrawal" && (
        <Field label="From bank" error={state.errors?.fromAccountId}>
          <SelectMenu
            name="fromAccountId"
            defaultValue={String(template?.fromAccountId ?? banks[0]?.id ?? "")}
            options={banks.map((a) => ({ value: String(a.id), label: a.name }))}
          />
        </Field>
      )}

      {type === "income" && (
        <>
          <Field label="To account" error={state.errors?.toAccountId}>
            <SelectMenu
              name="toAccountId"
              defaultValue={String(template?.toAccountId ?? nonCredit[0]?.id ?? "")}
              options={nonCredit.map((a) => ({ value: String(a.id), label: a.name }))}
            />
          </Field>
          <Field label="Source">
            <SelectMenu
              name="incomeSource"
              defaultValue={template?.incomeSource ?? "salary"}
              options={[
                { value: "salary", label: "Salary" },
                { value: "refund", label: "Refund" },
                { value: "cashback", label: "Cashback" },
                { value: "other", label: "Other" },
              ]}
            />
          </Field>
        </>
      )}

      <Field label="Repeats">
        <SelectMenu
          name="recurrence"
          value={recurrence}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "weekly", label: "Weekly" },
            { value: "yearly", label: "Yearly" },
          ]}
          onChange={(v) => setRecurrence(v as RecurringTemplate["recurrence"])}
        />
      </Field>

      {recurrence === "weekly" ? (
        <Field label="Day of week" error={state.errors?.dayOfWeek}>
          <SelectMenu
            name="dayOfWeek"
            defaultValue={String(template?.dayOfWeek ?? 1)}
            options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
          />
        </Field>
      ) : (
        <>
          {recurrence === "yearly" && (
            <Field label="Month" error={state.errors?.monthOfYear}>
              <SelectMenu
                name="monthOfYear"
                defaultValue={String(template?.monthOfYear ?? 1)}
                options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
              />
            </Field>
          )}
          <Field
            label="Day of month"
            error={state.errors?.dayOfMonth}
            hint="Day 29–31 falls back to the last day in shorter months."
          >
            <SelectMenu
              name="dayOfMonth"
              defaultValue={String(template?.dayOfMonth ?? 1)}
              options={Array.from({ length: 31 }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }))}
            />
          </Field>
        </>
      )}

      {state.errors?._ && <p className="text-[12px] text-alert">{state.errors._}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-control bg-primary text-primary-contrast font-semibold text-[14px] pressable disabled:opacity-60"
      >
        {pending ? "Saving…" : template ? "Save changes" : "Add recurring"}
      </button>
    </form>
  );
}
