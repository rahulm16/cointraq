"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Check, Wallet, Landmark, Target } from "lucide-react";
import type { Account } from "@/lib/types";
import { setOpeningBalances } from "@/actions/accounts";
import { setBudget } from "@/actions/budgets";
import { formatINR } from "@/lib/money";
import { useToast } from "@/components/toast";
import { TextInput } from "@/components/form";
import { Card, Eyebrow, Avatar } from "@/components/ui";
import { DUR, EASE, SPRING } from "@/lib/motion";
import { cn } from "@/lib/ui";

/**
 * First-run setup. The seed already creates accounts, methods and categories, so
 * the only things missing are the numbers only the user knows: what's actually
 * in each account today, and what they want to cap spending at.
 *
 * Getting opening balances right up front is what makes the first reconcile
 * meaningful instead of noise — that's the whole reason this screen exists.
 */
export function Onboarding({
  accounts,
  month,
  onDone,
}: {
  accounts: Account[];
  month: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [balances, setBalances] = useState<Record<number, string>>({});
  const [cap, setCap] = useState("");
  const [pending, startTransition] = useTransition();
  const { show } = useToast();

  // Credit cards are excluded: their "balance" is outstanding owed, which the
  // statement establishes rather than the user typing it here.
  const editable = accounts.filter((a) => a.type !== "credit_card");

  const saveBalances = () => {
    const entries = Object.entries(balances)
      .map(([id, v]) => ({ accountId: Number(id), openingBalance: Number(v.replace(/[^\d]/g, "") || 0) }))
      .filter((e) => Number.isFinite(e.openingBalance));

    startTransition(async () => {
      if (entries.length > 0) {
        const res = await setOpeningBalances(entries);
        if (!res.ok) {
          show(res.message ?? "Could not save balances", { tone: "error" });
          return;
        }
      }
      setStep(1);
    });
  };

  const finish = () => {
    const amount = Number(cap.replace(/[^\d]/g, "") || 0);
    startTransition(async () => {
      if (amount > 0) {
        const res = await setBudget(null, month, amount);
        if (!res.ok) {
          show(res.message ?? "Could not save budget", { tone: "error" });
          return;
        }
      }
      show("You're all set", { tone: "success" });
      onDone();
    });
  };

  return (
    <div className="max-w-[520px] mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: DUR.base, ease: EASE }}
        >
          {step === 0 ? (
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <Landmark size={14} strokeWidth={1.75} className="text-primary" aria-hidden />
                <Eyebrow>Step 1 of 2</Eyebrow>
              </div>
              <h2 className="text-[17px] font-semibold text-text-primary">
                What&apos;s in each account today?
              </h2>
              <p className="text-[13px] text-text-secondary mt-1 leading-relaxed">
                These become your starting balances. Every balance the app shows is
                counted forward from here, so rough is fine — you can correct them
                any time in Settings.
              </p>

              <div className="flex flex-col gap-3 mt-4">
                {editable.map((a) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <Avatar icon={a.icon} name={a.name} size={30} />
                    <span className="flex-1 min-w-0 text-[13.5px] text-text-primary truncate">
                      {a.name}
                    </span>
                    <div className="relative flex-none">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-text-faint pointer-events-none">
                        ₹
                      </span>
                      <TextInput
                        numeric
                        inputMode="numeric"
                        aria-label={`Balance in ${a.name}`}
                        placeholder="0"
                        value={balances[a.id] ?? ""}
                        onChange={(e) =>
                          setBalances((prev) => ({
                            ...prev,
                            [a.id]: e.currentTarget.value.replace(/[^\d]/g, ""),
                          }))
                        }
                        className="w-32 !pl-6 text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-5">
                <button
                  onClick={onDone}
                  className="h-11 px-4 rounded-control text-[13.5px] font-medium text-text-faint"
                >
                  Skip
                </button>
                <motion.button
                  onClick={saveBalances}
                  disabled={pending}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING}
                  className="flex-1 h-11 rounded-control bg-primary text-primary-contrast font-semibold text-[14px] flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  Continue <ArrowRight size={15} strokeWidth={2.25} />
                </motion.button>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <Target size={14} strokeWidth={1.75} className="text-primary" aria-hidden />
                <Eyebrow>Step 2 of 2</Eyebrow>
              </div>
              <h2 className="text-[17px] font-semibold text-text-primary">
                Set a monthly spending cap
              </h2>
              <p className="text-[13px] text-text-secondary mt-1 leading-relaxed">
                Optional, but it&apos;s what turns the dashboard from a record into a
                signal — you&apos;ll see whether you&apos;re ahead or behind pace every day.
              </p>

              <div className="relative mt-4">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[17px] text-text-faint pointer-events-none">
                  ₹
                </span>
                <TextInput
                  numeric
                  inputMode="numeric"
                  autoFocus
                  aria-label="Monthly spending cap"
                  placeholder="40000"
                  value={cap}
                  onChange={(e) => setCap(e.currentTarget.value.replace(/[^\d]/g, ""))}
                  className="w-full !h-14 !pl-9 !text-[20px]"
                />
              </div>

              {cap && Number(cap) > 0 && (
                <p className="text-[12px] text-text-faint mt-2 tnum">
                  About {formatINR(Math.floor(Number(cap) / 30))} a day.
                </p>
              )}

              <div className="flex items-center gap-2 mt-5">
                <button
                  onClick={() => setStep(0)}
                  className="h-11 px-4 rounded-control text-[13.5px] font-medium text-text-faint"
                >
                  Back
                </button>
                <motion.button
                  onClick={finish}
                  disabled={pending}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING}
                  className={cn(
                    "flex-1 h-11 rounded-control bg-primary text-primary-contrast font-semibold text-[14px]",
                    "flex items-center justify-center gap-1.5 disabled:opacity-60",
                  )}
                >
                  <Check size={15} strokeWidth={2.5} />
                  {cap && Number(cap) > 0 ? "Finish setup" : "Skip for now"}
                </motion.button>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-center gap-1.5 mt-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === step ? "w-5 bg-primary" : "w-1.5 bg-surface-raised",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** Wraps the first-run experience with the empty-dashboard fallback. */
export function FirstRun({ accounts, month }: { accounts: Account[]; month: string }) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="max-w-[520px] mx-auto text-center py-10">
        <div className="inline-flex size-12 rounded-full bg-primary/12 text-primary items-center justify-center mb-3">
          <Wallet size={22} strokeWidth={1.5} />
        </div>
        <h2 className="text-[16px] font-semibold text-text-primary">Ready when you are</h2>
        <p className="text-[13px] text-text-secondary mt-1">
          Log your first spend and the dashboard fills in.
        </p>
        <a
          href="/add"
          className="inline-flex items-center gap-1.5 mt-4 h-11 px-4 rounded-control bg-primary text-primary-contrast font-semibold text-[14px]"
        >
          Log a spend <ArrowRight size={15} strokeWidth={2.25} />
        </a>
      </div>
    );
  }

  return <Onboarding accounts={accounts} month={month} onDone={() => setDone(true)} />;
}
