"use client";

import { useActionState, useEffect, useState } from "react";
import type { Account, PaymentMethod } from "@/lib/types";
import { createMethod, updateMethod } from "@/actions/methods";
import type { ActionResult } from "@/actions/shared";
import { Field, TextInput, Select, SubmitButton } from "@/components/form";
import { IconUpload } from "@/components/icon-upload";
import { useToast } from "@/components/toast";

const initial: ActionResult = { ok: false };

export function MethodForm({
  method,
  accounts,
  onDone,
}: {
  method: PaymentMethod | null;
  accounts: Account[];
  onDone: () => void;
}) {
  const editing = !!method;
  const action = editing ? updateMethod : createMethod;
  const [state, formAction, pending] = useActionState(action, initial);
  const [name, setName] = useState(method?.name ?? "");
  const { show } = useToast();

  useEffect(() => {
    if (state.ok) {
      show(state.message ?? "Saved", { tone: "success" });
      onDone();
    }
  }, [state, show, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {editing && <input type="hidden" name="id" value={method.id} />}
      {state.errors?._ && <p className="text-[12.5px] text-alert">{state.errors._}</p>}

      <IconUpload name={name} defaultValue={method?.icon ?? null} />

      <Field label="Name" error={state.errors?.name}>
        <TextInput name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="GPay" />
      </Field>

      <Field label="Linked account" error={state.errors?.accountId} hint="The account money leaves when this method is used.">
        <Select
          name="accountId"
          defaultValue={method?.accountId ?? accounts[0]?.id}
          options={accounts.map((a) => ({
            value: String(a.id),
            label: a.type === "credit_card" ? `${a.name} (credit card)` : a.name,
          }))}
        />
      </Field>

      <div className="flex justify-end pt-2">
        <SubmitButton pending={pending}>{editing ? "Save method" : "Add method"}</SubmitButton>
      </div>
    </form>
  );
}
