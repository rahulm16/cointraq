"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { previewImport, commitImport, type ImportPreview } from "@/actions/import";
import { useToast } from "@/components/toast";
import { AppDrawer } from "@/components/drawer";
import { cn } from "@/lib/ui";

/**
 * Manual CSV import. Always previews first — this is the only action in the app
 * that can add hundreds of rows at once, so the user confirms against a parsed
 * summary rather than a filename.
 */
export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [filename, setFilename] = useState("");
  const [pending, startTransition] = useTransition();
  const { show } = useToast();

  const onFile = async (file: File) => {
    const text = await file.text();
    setFilename(file.name);
    setCsv(text);
    startTransition(async () => {
      setPreview(await previewImport(text));
    });
  };

  const close = () => {
    setCsv(null);
    setPreview(null);
    setFilename("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const commit = () => {
    if (!csv) return;
    startTransition(async () => {
      const res = await commitImport(csv);
      show(res.message ?? (res.ok ? "Imported" : "Import failed"), {
        tone: res.ok ? "success" : "error",
      });
      if (res.ok) close();
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="h-10 px-3.5 rounded-control bg-surface-raised text-[13px] font-medium text-text-secondary flex items-center gap-2 pressable"
      >
        <Upload size={14} strokeWidth={1.75} />
        Import CSV
      </button>

      <AppDrawer open={!!csv} onClose={close} title="Import transactions">
        {preview === null ? (
          <p className="text-[13px] text-text-secondary">Reading {filename}…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2.5">
              {preview.validCount > 0 ? (
                <CheckCircle2 size={18} strokeWidth={1.75} className="text-income flex-none mt-0.5" />
              ) : (
                <AlertTriangle size={18} strokeWidth={1.75} className="text-warning flex-none mt-0.5" />
              )}
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-text-primary">
                  {preview.validCount > 0
                    ? `${preview.validCount} transaction${preview.validCount === 1 ? "" : "s"} ready`
                    : "Nothing importable"}
                </div>
                <div className="text-[12px] text-text-faint mt-0.5 truncate">{filename}</div>
              </div>
            </div>

            {preview.duplicateCount > 0 && (
              <p className="text-[12px] text-text-secondary">
                {preview.duplicateCount} row{preview.duplicateCount === 1 ? " is" : "s are"} already in your
                ledger and will be skipped, so nothing is added twice.
              </p>
            )}

            <UnknownNames
              label="Categories not found"
              names={preview.unknownCategories}
              hint="Rows using these import without a category."
            />
            <UnknownNames
              label="Methods not found"
              names={preview.unknownMethods}
              hint="Spend rows using these are skipped — add the method first."
            />
            <UnknownNames
              label="Accounts not found"
              names={preview.unknownAccounts}
              hint="Transfers and income using these are skipped."
            />

            {preview.errors.length > 0 && (
              <div>
                <div className="text-[12px] font-medium text-text-secondary mb-1.5">
                  {preview.errors.length} row{preview.errors.length === 1 ? "" : "s"} will be skipped
                </div>
                <ul className="max-h-40 overflow-y-auto rounded-control bg-surface-raised p-2.5 flex flex-col gap-1">
                  {preview.errors.map((e, i) => (
                    <li key={i} className="text-[11.5px] text-text-faint">
                      <span className="tnum text-text-secondary">Line {e.line}</span> · {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={close}
                className="flex-1 h-11 rounded-control bg-surface-raised text-[14px] font-medium text-text-secondary pressable"
              >
                Cancel
              </button>
              <button
                onClick={commit}
                disabled={pending || preview.validCount === 0}
                className={cn(
                  "flex-1 h-11 rounded-control bg-primary text-primary-contrast font-semibold text-[14px] pressable",
                  "disabled:opacity-50",
                )}
              >
                {pending ? "Importing…" : `Import ${preview.validCount}`}
              </button>
            </div>
          </div>
        )}
      </AppDrawer>
    </>
  );
}

function UnknownNames({ label, names, hint }: { label: string; names: string[]; hint: string }) {
  if (names.length === 0) return null;
  return (
    <div>
      <div className="text-[12px] font-medium text-warning mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5 mb-1">
        {names.slice(0, 12).map((n) => (
          <span key={n} className="text-[11.5px] px-2 py-0.5 rounded-full bg-surface-raised text-text-secondary">
            {n}
          </span>
        ))}
        {names.length > 12 && (
          <span className="text-[11.5px] text-text-faint self-center">+{names.length - 12} more</span>
        )}
      </div>
      <div className="text-[11px] text-text-faint">{hint}</div>
    </div>
  );
}
