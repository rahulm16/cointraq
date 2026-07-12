import JSZip from "jszip";
import { cookies } from "next/headers";
import { verifySession, sessionCookieName } from "@/lib/auth";
import {
  getAllTransactions,
  getAccounts,
  getMethods,
  getCategories,
  getSnapshots,
} from "@/db/queries";
import { buildCsvs } from "@/lib/csv";
import { APP_NAME } from "@/lib/constants";
import { todayIST } from "@/lib/dates";

export const dynamic = "force-dynamic";

// One button → streams a zip of transactions/accounts/snapshots CSVs. SPEC §12.
export async function GET() {
  // Route handlers aren't covered by the same matcher path shape; re-check auth.
  const store = await cookies();
  if (!(await verifySession(store.get(sessionCookieName)?.value))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [transactions, accounts, methods, categories, snapshots] = await Promise.all([
    getAllTransactions(),
    getAccounts(true),
    getMethods(true),
    getCategories(true),
    getSnapshots(),
  ]);

  const csvs = buildCsvs({ transactions, accounts, methods, categories, snapshots });

  const zip = new JSZip();
  zip.file("transactions.csv", csvs.transactions);
  zip.file("accounts.csv", csvs.accounts);
  zip.file("snapshots.csv", csvs.snapshots);

  const blob = await zip.generateAsync({ type: "uint8array" });
  const filename = `${APP_NAME}-export-${todayIST()}.zip`;

  return new Response(blob as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
