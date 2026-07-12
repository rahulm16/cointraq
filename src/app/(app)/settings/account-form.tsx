"use client";

import { useActionState, useEffect, useState } from "react";
import type { Account } from "@/lib/types";
import { createAccount, updateAccount } from "@/actions/accounts";
import type { ActionResult } from "@/actions/shared";
import { Field, TextInput, Select, SubmitButton } from "@/components/form";
import { IconUpload } from "@/components/icon-upload";
import { useToast } from "@/components/toast";

const initial: ActionResult = { ok: false };

export function AccountForm({ account, onDone }: { account: Account | null; onDone: () => void }) {
  const editing = !!account;
  const action = editing ? updateAccount : createAccount;
  const [state, formAction, pending] = useActionState(action, initial);
  const [type, setType] = useState<string>(account?.type ?? "bank");
  const [name, setName] = useState(account?.name ?? "");
  const { show } = useToast();

  useEffect(() => {
    if (state.ok) {
      show(state.message ?? "Saved", { tone: "success" });
      onDone();
    }
  }, [state, show, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {editing && <input type="hidden" name="id" value={account.id} />}
      {state.errors?._ && <p className="text-[12.5px] text-alert">{state.errors._}</p>}

      <IconUpload name={name} defaultValue={account?.icon ?? null} />

      <Field label="Name" error={state.errors?.name}>
        <TextInput name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="HDFC Bank" />
      </Field>

      <Field label="Type" error={state.errors?.type}>
        <Select name="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="bank">Bank</option>
          <option value="credit_card">Credit card</option>
          <option value="cash">Cash</option>
        </Select>
      </Field>

      <Field
        label={type === "credit_card" ? "Opening outstanding owed" : "Opening balance"}
        error={state.errors?.openingBalance}
        hint="Whole rupees. Baseline before any transactions."
      >
        <TextInput
          name="openingBalance"
          numeric
          type="number"
          min={0}
          defaultValue={account?.openingBalance ?? 0}
        />
      </Field>

      {type === "credit_card" && (
        <Field label="Billing day (1–31)" error={state.errors?.billingDay}>
          <TextInput
            name="billingDay"
            numeric
            type="number"
            min={1}
            max={31}
            defaultValue={account?.billingDay ?? 17}
          />
        </Field>
      )}

      <div className="flex justify-end pt-2">
        <SubmitButton pending={pending}>{editing ? "Save account" : "Add account"}</SubmitButton>
      </div>
    </form>
  );
}
