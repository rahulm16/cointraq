"use client";

import { cn } from "@/lib/ui";
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-text-secondary">{label}</span>
      {children}
      {error ? (
        <span className="text-[11.5px] text-alert">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput({
  className,
  numeric,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { numeric?: boolean }) {
  return (
    <input
      {...props}
      className={cn(
        // Borderless (§1): affordance from the raised surface step; focus ring in primary.
        "h-10 px-3 rounded-control bg-surface-raised border border-transparent outline-none text-[15px] text-text-primary",
        "focus:border-primary placeholder:text-text-faint",
        numeric && "tnum",
        className,
      )}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 px-3 rounded-control bg-surface-raised border border-transparent outline-none text-[15px] text-text-primary focus:border-primary",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function PrimaryButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "h-11 px-4 rounded-control bg-primary text-primary-contrast font-semibold text-[15px] disabled:opacity-60 pressable",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "h-10 px-4 rounded-control bg-surface-raised text-[14px] font-medium text-text-primary disabled:opacity-60 pressable",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SubmitButton({ children, pending, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <PrimaryButton type="submit" disabled={pending} {...props}>
      {pending ? "Saving…" : children}
    </PrimaryButton>
  );
}
