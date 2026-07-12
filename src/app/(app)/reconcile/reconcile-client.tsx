"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveSnapshots, deleteSnapshotGroup } from "@/actions/reconcile";
import type { ActionResult } from "@/actions/shared";
import { Card, Avatar, StatusBadge, Eyebrow } from "@/components/ui";
import { ConfirmDialog } from "@/components/sheet";
import { SubmitButton } from "@/components/form";
import { useToast } from "@/components/toast";
import { formatINR } from "@/lib/money";
import { INRFlow } from "@/components/inr-flow";
import { CheckDraw } from "@/components/check-draw";
import { formatDayLabel } from "@/lib/dates";
import { fadeTransition } from "@/lib/motion";
import { motion } from "motion/react";
import { Trash2 } from "lucide-react";

interface Row {
  id: number;
  name: string;
  icon: string | null;
  type: string;
  expected: number;
}

const initial: ActionResult = { ok: false };

export function ReconcileClient({
  asOf,
  rows,
  history,
}: {
  asOf: string;
  today: string;
  rows: Row[];
  history: { date: string; count: number; unaccounted: number }[];
}) {
  const [state, formAction, pending] = useActionState(saveSnapshots, initial);
  const [actuals, setActuals] = useState<Record<number, string>>({});
  const [toDelete, setToDelete] = useState<string | null>(null);
  const { show } = useToast();

  useEffect(() => {
    if (state.ok) {
      show(state.message ?? "Saved", { tone: "success" });
      setActuals({});
    } else if (state.errors?._) {
      show(state.errors._, { tone: "error" });
    }
  }, [state, show]);

  const summary = useMemo(() => {
    let entered = 0;
    let unaccounted = 0;
    for (const r of rows) {
      const raw = actuals[r.id];
      if (raw == null || raw.trim() === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      entered += 1;
      unaccounted += n - r.expected;
    }
    return { entered, unaccounted };
  }, [actuals, rows]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-6 items-start">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Reconcile</h1>
          <p className="text-[13px] text-text-secondary mt-0.5">
            Enter today&apos;s actual balances. Anything unaccounted is a spend you didn&apos;t log.
            Reconcile before logging new spends for the day.
          </p>
        </div>

        <div className="flex items-center justify-between px-4 py-3 rounded-inner bg-surface-raised border border-transparent">
          <span className="text-[12.5px] tnum text-text-secondary">
            {summary.entered} of {rows.length} entered
            {summary.entered > 0 && summary.unaccounted !== 0 && (
              <>
                {" · "}
                <span className="text-warning">{formatINR(Math.abs(summary.unaccounted))} unaccounted</span>
              </>
            )}
          </span>
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="date" value={asOf} />
          {rows.map((r) => {
            const raw = actuals[r.id];
            const touched = raw != null && raw.trim() !== "";
            const delta = touched ? Number(raw) - r.expected : 0;
            return (
              <Card key={r.id}>
                <div className="flex items-center gap-2.5">
                  <Avatar icon={r.icon} name={r.name} size={30} />
                  <span className="text-[14px] font-semibold text-text-primary">{r.name}</span>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex-1 flex flex-col gap-1">
                    <Eyebrow>Expected</Eyebrow>
                    <span className="text-[16px] text-text-secondary">
                      <INRFlow value={r.expected} />
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <Eyebrow>Actual</Eyebrow>
                    <div className="h-[42px] flex items-center gap-1.5 px-3 rounded-control bg-surface-raised border border-transparent">
                      <span className="tnum text-[15px] text-text-faint">₹</span>
                      <input
                        name={`actual_${r.id}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={raw ?? ""}
                        onChange={(e) => setActuals((a) => ({ ...a, [r.id]: e.target.value }))}
                        placeholder="—"
                        className="flex-1 w-full bg-transparent outline-none tnum text-[15px] text-text-primary placeholder:text-text-faint"
                      />
                    </div>
                  </div>
                </div>
                {touched && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={fadeTransition()}
                    className="mt-3"
                  >
                    {delta === 0 ? (
                      <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-income">
                        <CheckDraw size={14} />
                        Matches
                      </span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[12.5px] font-semibold text-warning">
                          <INRFlow value={Math.abs(delta)} /> unaccounted
                        </div>
                        <div className="text-[11.5px] text-warning/75">
                          {delta < 0 ? "spends you may not have logged" : "unlogged income or credits"}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </Card>
            );
          })}

          <div className="flex flex-col gap-2">
            <SubmitButton pending={pending} className="h-12 w-full">Save snapshot</SubmitButton>
            <div className="text-[11.5px] text-text-faint text-center">
              Saves under <span className="tnum">{formatDayLabel(asOf)}</span>
            </div>
          </div>
        </form>
      </div>

      {/* History */}
      <div className="flex flex-col gap-3">
        <Eyebrow>Snapshot history</Eyebrow>
        <Card className="!p-0">
          <div className="px-4">
            {history.length === 0 && <div className="text-[13px] text-text-faint py-4">No snapshots yet.</div>}
            {history.map((h) => (
              <div key={h.date} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <span className="tnum text-[12.5px] text-text-primary">{formatDayLabel(h.date)}</span>
                <span className="text-[12px] text-text-faint">{h.count} account{h.count === 1 ? "" : "s"}</span>
                <span className="ml-auto">
                  {h.unaccounted === 0 ? (
                    <StatusBadge tone="income">All matched</StatusBadge>
                  ) : (
                    <span className="tnum text-[12px] font-medium text-warning">{formatINR(Math.abs(h.unaccounted))} off</span>
                  )}
                </span>
                <button onClick={() => setToDelete(h.date)} aria-label="Delete snapshot" className="text-text-faint hover:text-alert">
                  <Trash2 size={15} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this snapshot?"
        body="Removing it drops that baseline; expected balances recompute from the previous one."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!toDelete) return;
          const res = await deleteSnapshotGroup(toDelete);
          show(res.message ?? "Deleted", { tone: res.ok ? "success" : "error" });
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
