import { getAccounts, getMethods, getCategories } from "@/db/queries";
import { SettingsClient } from "./settings-client";
import { APP_NAME } from "@/lib/constants";

export const metadata = { title: `${APP_NAME} · Settings` };

export default async function SettingsPage() {
  const [accounts, methods, categories] = await Promise.all([
    getAccounts(true),
    getMethods(true),
    getCategories(true),
  ]);

  return (
    <main className="max-w-[1120px] mx-auto p-4 lg:p-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="text-[13px] text-text-secondary mt-0.5">
          Accounts, payment methods, categories, and app preferences.
        </p>
      </header>
      <SettingsClient accounts={accounts} methods={methods} categories={categories} />
    </main>
  );
}
