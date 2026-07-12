"use client";

import { useActionState, useEffect, useState } from "react";
import type { Account, Category, PaymentMethod, Transaction } from "@/lib/types";
import { updateTransaction, deleteTransaction } from "@/actions/transactions";
import type { ActionResult } from "@/actions/shared";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmDialog } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { formKindForType } from "@/lib/txn-display";
import {
  AmountInput,
  MethodChips,
  DateField,
  CategoryPicker,
  AccountSelect,
} from "../add/txn-fields";

const initial: ActionResult = { ok: false };

/**
 * Edit sheet — fields per the transaction's form-kind. The type is re-derived on
 * the server if the method crosses the CC boundary (SPEC §4 rule 1).
 */
export function EditForm({
  txn,
  accounts,
  methods,
  categories,
  today,
  onDone,
}: {
  txn: Transaction;
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  today: string;
  onDone: () => void;
}) {
  const kind = formKindForType(txn.type);
  const [state, formAction, pending] = useActionState(updateTransaction, initial);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { show } = useToast();

  const banks = accounts.filter((a) => a.type === "bank");
  const nonCredit = accounts.filter((a) => a.type !== "credit_card");
  const cards = accounts.filter((a) => a.type === "credit_card");
  const nonCardMethods = methods.filter(
    (m) => accounts.find((a) => a.id === m.accountId)?.type !== "credit_card",
  );

  useEffect(() => {
    if (state.ok) {
      show(state.message ?? "Updated", { tone: "success" });
      onDone();
    }
  }, [state, show, onDone]);

  async function doDelete() {
    setDeleting(true);
    const res = await deleteTransaction(txn.id);
    setDeleting(false);
    setConfirming(false);
    show(res.message ?? "Deleted", { tone: res.ok ? "success" : "error" });
    onDone();
  }

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={txn.id} />
        <input type="hidden" name="kind" value={kind} />

        <AmountInput defaultValue={txn.amount} />
        {state.errors?.amount && <p className="text-[12px] text-alert -mt-2">{state.errors.amount}</p>}
        {state.errors?._ && <p className="text-[12px] text-alert">{state.errors._}</p>}

        {kind === "spend" && (
          <>
            <Field label="Method" error={state.errors?.methodId}>
              <MethodChips methods={methods} accounts={accounts} defaultId={txn.methodId} />
            </Field>
            <Field label="Category (optional)">
              <CategoryPicker categories={categories} defaultId={txn.categoryId} />
            </Field>
          </>
        )}

        {kind === "bill_pay" && (
          <>
            <Field label="Pay from method" error={state.errors?.methodId}>
              <MethodChips methods={nonCardMethods} accounts={accounts} defaultId={txn.methodId} />
            </Field>
            <Field label="Credit card being paid" error={state.errors?.toAccountId}>
              <AccountSelect name="toAccountId" accounts={cards} defaultId={txn.toAccountId} />
            </Field>
          </>
        )}

        {kind === "transfer" && (
          <>
            <Field label="From" error={state.errors?.fromAccountId}>
              <AccountSelect name="fromAccountId" accounts={nonCredit} defaultId={txn.fromAccountId} />
            </Field>
            <Field label="To" error={state.errors?.toAccountId}>
              <AccountSelect name="toAccountId" accounts={nonCredit} defaultId={txn.toAccountId} />
            </Field>
          </>
        )}

        {kind === "withdrawal" && (
          <Field label="From bank" error={state.errors?.fromAccountId}>
            <AccountSelect name="fromAccountId" accounts={banks} defaultId={txn.fromAccountId} />
          </Field>
        )}

        {kind === "income" && (
          <>
            <Field label="Landed in" error={state.errors?.toAccountId}>
              <AccountSelect name="toAccountId" accounts={nonCredit} defaultId={txn.toAccountId} />
            </Field>
            <Field label="Source" error={state.errors?.incomeSource}>
              <select name="incomeSource" defaultValue={txn.incomeSource ?? "salary"} className="h-10 px-3 rounded-control bg-surface-raised border border-border outline-none text-[15px] text-text-primary focus:border-primary w-full">
                <option value="salary">Salary</option>
                <option value="refund">Refund</option>
                <option value="cashback">Cashback</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </>
        )}

        <Field label="Date" error={state.errors?.date}>
          <DateField today={today} defaultValue={txn.date} />
        </Field>

        <Field label="Note (optional)" error={state.errors?.note}>
          <input
            name="note"
            maxLength={200}
            defaultValue={txn.note ?? ""}
            className="h-10 px-3 rounded-control bg-surface-raised border border-border outline-none text-[15px] text-text-primary focus:border-primary"
          />
        </Field>

        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={() => setConfirming(true)} className="text-[14px] font-medium text-alert">
            Delete
          </button>
          <SubmitButton pending={pending}>Save changes</SubmitButton>
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        title="Delete this transaction?"
        body="This permanently removes it. Balances will recompute."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={doDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
