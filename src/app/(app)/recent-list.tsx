"use client";

import { useState } from "react";
import Link from "next/link";
import type { Account, Category, PaymentMethod, Transaction } from "@/lib/types";
import type { TitlesByKind } from "@/lib/txn-display";
import { Card } from "@/components/ui";
import { AppDrawer } from "@/components/drawer";
import { TxnRow } from "@/components/txn-row";
import { EditForm } from "./transactions/edit-form";

export function RecentList({
  recent,
  accounts,
  methods,
  categories,
  today,
  titlesByKind,
}: {
  recent: Transaction[];
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  today: string;
  titlesByKind: TitlesByKind;
}) {
  const [editing, setEditing] = useState<Transaction | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">Recent</h2>
        <Link href="/transactions" className="text-[13px] font-medium text-primary">
          View all
        </Link>
      </div>
      <Card className="!p-0 overflow-hidden">
        <div className="[&>*:last-child]:border-b-0">
          {recent.map((t) => (
            <TxnRow
              key={t.id}
              txn={t}
              accounts={accounts}
              methods={methods}
              categories={categories}
              onClick={() => setEditing(t)}
            />
          ))}
          {recent.length === 0 && (
            <div className="text-[13px] text-text-faint px-4 py-4">No transactions yet.</div>
          )}
        </div>
      </Card>

      <AppDrawer open={!!editing} onClose={() => setEditing(null)} title="Edit transaction">
        {editing && (
          <EditForm
            txn={editing}
            accounts={accounts}
            methods={methods}
            categories={categories}
            today={today}
            titlesByKind={titlesByKind}
            onDone={() => setEditing(null)}
          />
        )}
      </AppDrawer>
    </div>
  );
}
