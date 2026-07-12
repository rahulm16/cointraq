"use client";

import { useState, useTransition } from "react";
import type { Account, Category, PaymentMethod } from "@/lib/types";
import { Avatar, Card, StatusBadge } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { GhostButton } from "@/components/form";
import { cn } from "@/lib/ui";
import { CATEGORY_COLORS } from "@/lib/constants";
import { categoryClasses } from "@/lib/ui";
import { Plus } from "lucide-react";
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
        <div className="flex flex-col divide-y divide-border">
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
        <div className="flex flex-col divide-y divide-border">
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
      <Section title="Categories" onAdd={() => setEditor({ kind: "category", value: null })}>
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
      <Sheet
        open={editor?.kind === "account"}
        onClose={() => setEditor(null)}
        title={editor?.kind === "account" && editor.value ? "Edit account" : "New account"}
      >
        {editor?.kind === "account" && (
          <AccountForm account={editor.value} onDone={() => setEditor(null)} />
        )}
      </Sheet>

      <Sheet
        open={editor?.kind === "method"}
        onClose={() => setEditor(null)}
        title={editor?.kind === "method" && editor.value ? "Edit method" : "New method"}
      >
        {editor?.kind === "method" && (
          <MethodForm method={editor.value} accounts={accounts.filter((a) => !a.isArchived)} onDone={() => setEditor(null)} />
        )}
      </Sheet>

      <Sheet
        open={editor?.kind === "category"}
        onClose={() => setEditor(null)}
        title={editor?.kind === "category" && editor.value ? "Edit category" : "New category"}
      >
        {editor?.kind === "category" && (
          <CategoryForm category={editor.value} onDone={() => setEditor(null)} />
        )}
      </Sheet>

      <div className="lg:hidden h-2" aria-hidden />
      <p className="text-center text-[11px] text-text-faint">{CATEGORY_COLORS.length} palette colors available for categories.</p>
    </div>
  );
}

function Section({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
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
        <div className="p-4">{children}</div>
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
  return (
    <div className={cn("flex items-center gap-3 py-3 first:pt-0 last:pb-0", archived && "opacity-60")}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-text-primary truncate">{title}</span>
          {badges}
          {archived && <StatusBadge tone="faint">Archived</StatusBadge>}
        </div>
        <div className="text-[12px] text-text-secondary truncate">{subtitle}</div>
      </div>
      <div className="flex items-center gap-3">
        {extraActions}
        <button className="text-[12.5px] font-medium text-text-secondary" onClick={onEdit}>
          Edit
        </button>
        <button className="text-[12.5px] font-medium text-text-secondary" onClick={onArchiveToggle}>
          {archived ? "Restore" : "Archive"}
        </button>
      </div>
    </div>
  );
}

function Empty() {
  return <div className="text-[13px] text-text-faint py-2">Nothing here yet.</div>;
}
