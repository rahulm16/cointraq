"use client";

import { useState, useTransition } from "react";
import type { Account, Category, PaymentMethod } from "@/lib/types";
import { Avatar, Card, StatusBadge } from "@/components/ui";
import { AppDrawer } from "@/components/drawer";
import { SwipeRow } from "@/components/swipe-row";
import { useToast } from "@/components/toast";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { GhostButton } from "@/components/form";
import { cn } from "@/lib/ui";
import { CATEGORY_COLORS } from "@/lib/constants";
import { categoryClasses } from "@/lib/ui";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { logout } from "@/actions/auth";
import { setAccountArchived } from "@/actions/accounts";
import { setMethodArchived, setDefaultMethod } from "@/actions/methods";
import { AccountForm } from "./account-form";
import { MethodForm } from "./method-form";
import { CategoryForm } from "./category-form";
import { ExportButton } from "./export-button";

type Editor =
  | { kind: "account"; value: Account | null }
  | { kind: "method"; value: PaymentMethod | null }
  | { kind: "category"; value: Category | null }
  | null;

export function SettingsClient({
  accounts,
  methods,
  categories,
}: {
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
}) {
  const [editor, setEditor] = useState<Editor>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { show } = useToast();
  const [, startTransition] = useTransition();

  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? "—";

  function archiveAction(fn: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const res = await fn();
      show(res.message ?? (res.ok ? "Done" : "Failed"), { tone: res.ok ? "success" : "error" });
    });
  }

  const visibleMethods = methods.filter((m) => showArchived || !m.isArchived);
  const visibleAccounts = accounts.filter((a) => showArchived || !a.isArchived);
  const visibleCategories = categories.filter((c) => showArchived || !c.isArchived);

  return (
    <Tooltip.Provider delayDuration={200}>
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-[13px] text-text-secondary cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      {/* Payment methods */}
      <Section
        title="Payment methods"
        onAdd={() => setEditor({ kind: "method", value: null })}
      >
        <div className="flex flex-col">
          {visibleMethods.map((m) => (
            <Row
              key={m.id}
              icon={<Avatar icon={m.icon} name={m.name} size={34} />}
              title={m.name}
              subtitle={`→ ${accountName(m.accountId)}`}
              archived={m.isArchived}
              badges={m.isDefault && <StatusBadge tone="income">Default</StatusBadge>}
              onEdit={() => setEditor({ kind: "method", value: m })}
              extraActions={
                !m.isArchived && !m.isDefault ? (
                  <button
                    className="text-[12.5px] font-medium text-primary"
                    onClick={() => archiveAction(() => setDefaultMethod(m.id))}
                  >
                    Make default
                  </button>
                ) : null
              }
              onArchiveToggle={() => archiveAction(() => setMethodArchived(m.id, !m.isArchived))}
            />
          ))}
          {visibleMethods.length === 0 && <Empty />}
        </div>
      </Section>

      {/* Accounts */}
      <Section title="Accounts" onAdd={() => setEditor({ kind: "account", value: null })}>
        <div className="flex flex-col">
          {visibleAccounts.map((a) => (
            <Row
              key={a.id}
              icon={<Avatar icon={a.icon} name={a.name} size={34} />}
              title={a.name}
              subtitle={
                a.type === "credit_card"
                  ? `Credit card · bills on day ${a.billingDay ?? "—"}`
                  : a.type === "cash"
                    ? "Cash"
                    : "Bank"
              }
              archived={a.isArchived}
              onEdit={() => setEditor({ kind: "account", value: a })}
              onArchiveToggle={() => archiveAction(() => setAccountArchived(a.id, !a.isArchived))}
            />
          ))}
          {visibleAccounts.length === 0 && <Empty />}
        </div>
      </Section>

      {/* Categories */}
      <Section title="Categories" onAdd={() => setEditor({ kind: "category", value: null })} padded>
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((c) => {
            const cc = categoryClasses(c.color);
            return (
              <button
                key={c.id}
                onClick={() => setEditor({ kind: "category", value: c })}
                className={cn(
                  "h-8 inline-flex items-center gap-2 px-3 rounded-full text-[13px] font-medium",
                  cc.pill,
                  c.isArchived && "opacity-50 line-through",
                )}
              >
                {c.name}
              </button>
            );
          })}
          {visibleCategories.length === 0 && <Empty />}
        </div>
      </Section>

      {/* Preferences */}
      <Card>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[14px] font-semibold text-text-primary">Theme</div>
              <div className="text-[12px] text-text-secondary">Dark is the default.</div>
            </div>
            <ThemeSwitcher />
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap border-t border-border pt-5">
            <div>
              <div className="text-[14px] font-semibold text-text-primary">Export</div>
              <div className="text-[12px] text-text-secondary">Download all data as a CSV zip.</div>
            </div>
            <ExportButton />
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap border-t border-border pt-5">
            <div>
              <div className="text-[14px] font-semibold text-text-primary">Password</div>
              <div className="text-[12px] text-text-secondary">Set via the APP_PASSWORD_HASH environment variable.</div>
            </div>
            <form action={logout}>
              <GhostButton type="submit">Log out</GhostButton>
            </form>
          </div>
        </div>
      </Card>

      {/* Editors */}
      <AppDrawer
        open={editor?.kind === "account"}
        onClose={() => setEditor(null)}
        title={editor?.kind === "account" && editor.value ? "Edit account" : "New account"}
      >
        {editor?.kind === "account" && (
          <AccountForm account={editor.value} onDone={() => setEditor(null)} />
        )}
      </AppDrawer>

      <AppDrawer
        open={editor?.kind === "method"}
        onClose={() => setEditor(null)}
        title={editor?.kind === "method" && editor.value ? "Edit method" : "New method"}
      >
        {editor?.kind === "method" && (
          <MethodForm method={editor.value} accounts={accounts.filter((a) => !a.isArchived)} onDone={() => setEditor(null)} />
        )}
      </AppDrawer>

      <AppDrawer
        open={editor?.kind === "category"}
        onClose={() => setEditor(null)}
        title={editor?.kind === "category" && editor.value ? "Edit category" : "New category"}
      >
        {editor?.kind === "category" && (
          <CategoryForm category={editor.value} onDone={() => setEditor(null)} />
        )}
      </AppDrawer>

      <div className="lg:hidden h-2" aria-hidden />
      <p className="text-center text-[11px] text-text-faint">{CATEGORY_COLORS.length} palette colors available for categories.</p>
    </div>
    </Tooltip.Provider>
  );
}

function Section({
  title,
  onAdd,
  children,
  padded = false,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
  /** Use for non-list content (e.g. category pills). List rows stay full-bleed for swipe. */
  padded?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">{title}</h2>
        <button onClick={onAdd} className="text-[13px] font-semibold text-primary flex items-center gap-1">
          <Plus size={15} strokeWidth={2} />
          New
        </button>
      </div>
      <Card className="!p-0 overflow-hidden">
        <div className={padded ? "p-4" : undefined}>{children}</div>
      </Card>
    </section>
  );
}

function Row({
  icon,
  title,
  subtitle,
  archived,
  badges,
  extraActions,
  onEdit,
  onArchiveToggle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  archived: boolean;
  badges?: React.ReactNode;
  extraActions?: React.ReactNode;
  onEdit: () => void;
  onArchiveToggle: () => void;
}) {
  const archiveLabel = archived ? "Restore" : "Archive";

  return (
    <SwipeRow
      className="border-b border-border last:border-b-0"
      leftAction={{
        label: "Edit",
        onClick: onEdit,
        className: "bg-primary",
        icon: <Pencil size={16} strokeWidth={1.75} />,
      }}
      rightAction={{
        label: archiveLabel,
        onClick: onArchiveToggle,
        className: archived ? "bg-income" : "bg-alert",
        icon: archived ? (
          <ArchiveRestore size={16} strokeWidth={1.75} />
        ) : (
          <Archive size={16} strokeWidth={1.75} />
        ),
      }}
    >
      <div
        className={cn(
          "group relative flex items-center gap-3 px-4 py-3 transition-colors can-hover:hover:bg-surface-raised/50",
          archived && "opacity-60",
        )}
      >
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-text-primary truncate">{title}</span>
            {badges}
            {archived && <StatusBadge tone="faint">Archived</StatusBadge>}
          </div>
          <div className="text-[12px] text-text-secondary truncate">{subtitle}</div>
        </div>

        {extraActions && (
          <div
            className={cn(
              "flex items-center flex-none transition-transform",
              "can-hover:group-hover:-translate-x-16",
            )}
          >
            {extraActions}
          </div>
        )}

        <div className="hidden can-hover:flex absolute right-1 items-center gap-1 opacity-0 translate-x-2 pointer-events-none transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto">
          <IconTooltip label="Edit">
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit"
              className="icon-btn w-8 h-8 rounded-full flex items-center justify-center text-text-secondary"
            >
              <Pencil size={15} strokeWidth={1.75} />
            </button>
          </IconTooltip>
          <IconTooltip label={archiveLabel}>
            <button
              type="button"
              onClick={onArchiveToggle}
              aria-label={archiveLabel}
              className={cn(
                "icon-btn w-8 h-8 rounded-full flex items-center justify-center text-text-secondary",
                !archived && "hover:!text-alert",
              )}
            >
              {archived ? (
                <ArchiveRestore size={15} strokeWidth={1.75} />
              ) : (
                <Archive size={15} strokeWidth={1.75} />
              )}
            </button>
          </IconTooltip>
        </div>
      </div>
    </SwipeRow>
  );
}

function IconTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          className="z-50 px-2.5 py-1.5 rounded-[10px] bg-surface-overlay text-text-primary text-[12px] font-medium shadow-[var(--shadow-overlay)] select-none"
        >
          {label}
          <Tooltip.Arrow className="fill-surface-overlay" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function Empty() {
  return <div className="text-[13px] text-text-faint px-4 py-3">Nothing here yet.</div>;
}
