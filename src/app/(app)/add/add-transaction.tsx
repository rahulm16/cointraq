"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Account, Category, PaymentMethod } from "@/lib/types";
import { createTransaction } from "@/actions/transactions";
import type { ActionResult } from "@/actions/shared";
import { Field } from "@/components/form";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/ui";
import { formatINR } from "@/lib/money";
import { motion } from "motion/react";
import { SPRING } from "@/lib/motion";
import { Check } from "lucide-react";
import {
  AmountInput,
  MethodChips,
  CcHint,
  DateField,
  CategoryPicker,
  AccountSelect,
} from "./txn-fields";

type Tab = "spend" | "bill_pay" | "transfer" | "withdrawal" | "income";
const TABS: { id: Tab; label: string }[] = [
  { id: "spend", label: "Spend" },
  { id: "bill_pay", label: "Bill pay" },
  { id: "transfer", label: "Transfer" },
  { id: "withdrawal", label: "Withdraw" },
  { id: "income", label: "Income" },
];

const initial: ActionResult = { ok: false };

export function AddTransaction({
  accounts,
  methods,
  categories,
  today,
  lastStatements,
}: {
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  today: string;
  lastStatements: { cardId: number; remaining: number; lastStatement: number }[];
}) {
  const [tab, setTab] = useState<Tab>("spend");
  const [state, formAction, pending] = useActionState(createTransaction, initial);
  const [justSaved, setJustSaved] = useState(false);
  const { show } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  // Track the selected spend method to show the CC cycle hint.
  const defaultMethod = methods.find((m) => m.isDefault) ?? methods[0] ?? null;
  const [spendMethod, setSpendMethod] = useState<PaymentMethod | null>(defaultMethod);

  const banks = accounts.filter((a) => a.type === "bank");
  const nonCredit = accounts.filter((a) => a.type !== "credit_card");
  const cards = accounts.filter((a) => a.type === "credit_card");
  const nonCardMethods = methods.filter(
    (m) => accounts.find((a) => a.id === m.accountId)?.type !== "credit_card",
  );

  const spendCard =
    spendMethod && accounts.find((a) => a.id === spendMethod.accountId)?.type === "credit_card"
      ? accounts.find((a) => a.id === spendMethod.accountId)!
      : null;

  useEffect(() => {
    if (state.ok) {
      // Button morphs to a check for 600ms (§8).
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 600);
      show("Saved", {
        tone: "success",
        action: {
          label: "Add another",
          onClick: () => {
            // Reset amount & note but keep method/date by only clearing those inputs.
            const f = formRef.current;
            if (!f) return;
            (f.elements.namedItem("amount") as HTMLInputElement | null)?.setAttribute("value", "");
            const amt = f.querySelector<HTMLInputElement>('input[name="amount"]');
            const note = f.querySelector<HTMLInputElement>('input[name="note"]');
            if (amt) amt.value = "";
            if (note) note.value = "";
            amt?.focus();
          },
        },
      });
      // Clear amount/note immediately after a successful save too.
      const f = formRef.current;
      const amt = f?.querySelector<HTMLInputElement>('input[name="amount"]');
      const note = f?.querySelector<HTMLInputElement>('input[name="note"]');
      if (amt) amt.value = "";
      if (note) note.value = "";
      return () => clearTimeout(t);
    }
  }, [state, show]);

  return (
    <div className="flex flex-col gap-4">
      {/* Segmented type control with sliding indicator (§8) */}
      <div className="flex gap-1 p-1 rounded-full bg-surface-raised overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative flex-1 min-w-max h-9 px-3 rounded-full text-[13px] font-medium whitespace-nowrap pressable",
              tab === t.id ? "text-primary-contrast" : "text-text-secondary",
            )}
          >
            {tab === t.id && (
              <motion.span layoutId="add-tab-pill" transition={SPRING} className="absolute inset-0 rounded-full bg-primary" />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <div>
        {/* key forces a fresh form (and fresh field state) when switching tabs */}
        <form key={tab} ref={formRef} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="kind" value={tab} />

          <AmountInput />
          {state.errors?.amount && <p className="text-[12px] text-alert -mt-2">{state.errors.amount}</p>}
          {state.errors?._ && <p className="text-[12px] text-alert">{state.errors._}</p>}

          {tab === "spend" && (
            <>
              <Field label="Method" error={state.errors?.methodId}>
                <MethodChips
                  methods={methods}
                  accounts={accounts}
                  defaultId={defaultMethod?.id ?? null}
                  onSelect={setSpendMethod}
                />
              </Field>
              {spendCard && <CcHint billingDay={spendCard.billingDay ?? 1} date={today} />}
              <Field label="Category (optional)">
                <CategoryPicker categories={categories} />
              </Field>
            </>
          )}

          {tab === "bill_pay" && (
            <>
              <Field label="Pay from method" error={state.errors?.methodId}>
                <MethodChips methods={nonCardMethods} accounts={accounts} defaultId={nonCardMethods.find((m) => m.isDefault)?.id ?? nonCardMethods[0]?.id ?? null} />
              </Field>
              <Field label="Credit card being paid" error={state.errors?.toAccountId}>
                <div className="flex flex-col gap-2">
                  <AccountSelect name="toAccountId" accounts={cards} defaultId={cards[0]?.id ?? null} placeholder={cards.length ? undefined : "No credit cards"} />
                  {cards[0] &&
                    (() => {
                      const st = lastStatements.find((s) => s.cardId === cards[0].id);
                      if (!st || st.remaining <= 0) return null;
                      return (
                        <BillPrefill remaining={st.remaining} />
                      );
                    })()}
                </div>
              </Field>
            </>
          )}

          {tab === "transfer" && (
            <>
              <Field label="From" error={state.errors?.fromAccountId}>
                <AccountSelect name="fromAccountId" accounts={nonCredit} defaultId={nonCredit[0]?.id ?? null} />
              </Field>
              <Field label="To" error={state.errors?.toAccountId}>
                <AccountSelect name="toAccountId" accounts={nonCredit} defaultId={nonCredit[1]?.id ?? null} />
              </Field>
            </>
          )}

          {tab === "withdrawal" && (
            <Field label="From bank" error={state.errors?.fromAccountId} hint="Moves cash into your Cash in hand.">
              <AccountSelect name="fromAccountId" accounts={banks} defaultId={banks[0]?.id ?? null} />
            </Field>
          )}

          {tab === "income" && (
            <>
              <Field label="Landed in" error={state.errors?.toAccountId}>
                <AccountSelect name="toAccountId" accounts={nonCredit} defaultId={nonCredit[0]?.id ?? null} />
              </Field>
              <Field label="Source" error={state.errors?.incomeSource}>
                <select name="incomeSource" defaultValue="salary" className="h-10 px-3 rounded-control bg-surface-raised border border-transparent outline-none text-[15px] text-text-primary focus:border-primary w-full">
                  <option value="salary">Salary</option>
                  <option value="refund">Refund</option>
                  <option value="cashback">Cashback</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </>
          )}

          <Field label="Date" error={state.errors?.date}>
            <DateField today={today} />
          </Field>

          <Field label="Note (optional)" error={state.errors?.note}>
            <input
              name="note"
              maxLength={200}
              placeholder={tab === "bill_pay" ? "credit card bill" : "dinner with Adi"}
              className="h-10 px-3 rounded-control bg-surface-raised border border-transparent outline-none text-[15px] text-text-primary focus:border-primary"
            />
          </Field>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pending || justSaved}
              className="h-11 px-5 min-w-[112px] rounded-control bg-primary text-primary-contrast font-semibold text-[15px] disabled:opacity-100 pressable flex items-center justify-center gap-2"
            >
              {justSaved ? (
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING}>
                  <Check size={18} strokeWidth={2.5} />
                </motion.span>
              ) : (
                <span>{pending ? "Saving…" : "Save spend"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BillPrefill({ remaining }: { remaining: number }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        const form = (e.currentTarget.closest("form") as HTMLFormElement) ?? null;
        const amt = form?.querySelector<HTMLInputElement>('input[name="amount"]');
        if (amt) amt.value = String(remaining);
      }}
      className="self-start h-8 px-3 rounded-full bg-primary/15 text-primary text-[12.5px] font-medium pressable"
    >
      Full bill · {formatINR(remaining)}
    </button>
  );
}
