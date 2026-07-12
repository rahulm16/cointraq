"use client";

import { cn } from "@/lib/ui";
import type { ReactNode, InputHTMLAttributes } from "react";
import { SelectMenu } from "@/components/select-menu";

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
        // Borderless: affordance from the raised surface step; caret shows focus.
        "h-10 px-3 rounded-control bg-surface-raised border border-transparent outline-none text-[15px] text-text-primary",
        "placeholder:text-text-faint",
        numeric && "tnum",
        className,
      )}
    />
  );
}

export function Select({
  name,
  value,
  defaultValue,
  onChange,
  options,
  placeholder,
  className,
  children,
}: {
  name?: string;
  value?: string;
  defaultValue?: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  options?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  /** Legacy: option children — prefer `options` prop. */
  children?: ReactNode;
}) {
  // Support both options[] and legacy <option> children.
  const parsed: { value: string; label: string }[] = options
    ? options
    : (() => {
        const out: { value: string; label: string }[] = [];
        const walk = (nodes: ReactNode) => {
          for (const child of Array.isArray(nodes) ? nodes : [nodes]) {
            if (!child || typeof child !== "object") continue;
            const el = child as { type?: unknown; props?: { value?: string | number; children?: ReactNode } };
            if (el.type === "option" && el.props) {
              out.push({
                value: String(el.props.value ?? ""),
                label: String(el.props.children ?? ""),
              });
            }
          }
        };
        walk(children);
        return out;
      })();

  return (
    <SelectMenu
      name={name}
      value={value}
      defaultValue={defaultValue != null ? String(defaultValue) : undefined}
      options={parsed}
      placeholder={placeholder}
      className={className}
      onChange={(v) => onChange?.({ target: { value: v } })}
    />
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
