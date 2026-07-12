"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/ui";

export type SelectOption = { value: string; label: string };

/**
 * Custom select — raised surface trigger + floating menu. Never uses native
 * chrome `<select>` so styling stays consistent across platforms.
 */
export function SelectMenu({
  name,
  value: valueProp,
  defaultValue,
  options,
  onChange,
  placeholder = "Select",
  className,
  triggerClassName,
  renderTrigger,
  align = "start",
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  options: SelectOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  /** Optional fully custom trigger (e.g. filter chip). */
  renderTrigger?: (args: {
    open: boolean;
    label: string;
    active: boolean;
    toggle: () => void;
  }) => ReactNode;
  align?: "start" | "end";
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp! : uncontrolled;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;
  const active = value !== "" && value != null;

  function setValue(next: string) {
    if (!controlled) setUncontrolled(next);
    onChange?.(next);
    setOpen(false);
  }

  function toggle() {
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: align === "end" ? rect.right : rect.left,
      width: Math.max(rect.width, 180),
    });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {name != null && <input type="hidden" name={name} value={value} />}
      {renderTrigger ? (
        renderTrigger({ open, label, active, toggle })
      ) : (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={toggle}
          className={cn(
            "h-10 w-full px-3 rounded-control bg-surface-raised border border-transparent outline-none text-[15px] text-text-primary",
            "flex items-center justify-between gap-2 text-left pressable",
            triggerClassName,
          )}
        >
          <span className={cn("truncate", !active && "text-text-faint")}>{label}</span>
          <ChevronDown size={16} strokeWidth={1.75} className={cn("shrink-0 text-text-faint transition-transform", open && "rotate-180")} />
        </button>
      )}

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            style={{
              position: "fixed",
              top: pos.top,
              left: align === "end" ? undefined : pos.left,
              right: align === "end" ? window.innerWidth - pos.left : undefined,
              width: pos.width,
              zIndex: 70,
            }}
            className="max-h-64 overflow-auto rounded-control bg-surface-overlay border border-border shadow-[var(--shadow-overlay)]"
          >
            {options.map((o, i) => {
              const isSel = o.value === value;
              const isFirst = i === 0;
              const isLast = i === options.length - 1;
              return (
                <button
                  key={o.value === "" ? "__empty" : o.value}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => setValue(o.value)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-[14px] pressable",
                    isFirst && "rounded-t-[13px]",
                    isLast && "rounded-b-[13px]",
                    isSel ? "bg-primary/10 text-primary font-medium" : "text-text-primary hover:bg-surface-raised",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check size={15} strokeWidth={2} className="shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
