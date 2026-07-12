"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";
import { Lock } from "lucide-react";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="w-full mt-7 flex flex-col gap-3.5">
      <div
        className={`h-[46px] flex items-center gap-2.5 px-3.5 rounded-control bg-surface-raised border ${
          state.error ? "border-alert" : "border-border"
        }`}
      >
        <Lock size={15} strokeWidth={1.5} className="text-text-faint" />
        <input
          type="password"
          name="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          className="flex-1 bg-transparent outline-none text-[16px] tnum tracking-widest text-text-primary placeholder:text-text-faint"
        />
      </div>

      {state.error && <p className="text-[12.5px] text-alert -mt-1">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-[46px] rounded-control bg-primary text-primary-contrast font-semibold text-[14.5px] disabled:opacity-60"
      >
        {pending ? "Unlocking…" : "Unlock"}
      </button>
    </form>
  );
}
