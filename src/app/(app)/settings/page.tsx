import { getAccounts, getMethods, getCategories, getRecurringTemplates } from "@/db/queries";
import { SettingsClient } from "./settings-client";
import { RecurringSection } from "./recurring-section";
import { APP_NAME } from "@/lib/constants";
import { todayIST } from "@/lib/dates";

export const metadata = { title: `${APP_NAME} · Settings` };

export default async function SettingsPage() {
  const [accounts, methods, categories, templates] = await Promise.all([
    getAccounts(true),
    getMethods(true),
    getCategories(true),
    getRecurringTemplates(true),
  ]);
  const today = todayIST();

  return (
    <main className="max-w-[1120px] mx-auto p-4 lg:p-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="text-[13px] text-text-secondary mt-0.5">
          Accounts, payment methods, categories, and app preferences.
        </p>
      </header>

      <div className="mb-4">
        <RecurringSection
          templates={templates}
          accounts={accounts.filter((a) => !a.isArchived)}
          methods={methods.filter((m) => !m.isArchived)}
          categories={categories.filter((c) => !c.isArchived)}
          today={today}
        />
      </div>

      <SettingsClient accounts={accounts} methods={methods} categories={categories} />
    </main>
  );
}
