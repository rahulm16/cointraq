"use client";

import { useRef, useState } from "react";
import { processIconFile } from "@/lib/icon-client";
import { Avatar } from "./ui";

/**
 * Uploads an icon through the §9 pipeline, keeps the base64 result in a hidden
 * input named `icon` so it posts with the parent form. Value may be cleared.
 */
export function IconUpload({
  name,
  defaultValue,
  initial = null,
}: {
  name: string; // used for the monogram fallback
  defaultValue?: string | null;
  initial?: string | null;
}) {
  const [icon, setIcon] = useState<string | null>(defaultValue ?? initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await processIconFile(file);
      setIcon(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input type="hidden" name="icon" value={icon ?? ""} />
      <Avatar icon={icon} name={name || "?"} size={44} />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="h-8 px-3 rounded-control bg-surface-raised border border-border text-[13px] font-medium text-text-primary disabled:opacity-60"
          >
            {busy ? "Processing…" : icon ? "Replace" : "Upload icon"}
          </button>
          {icon && (
            <button
              type="button"
              onClick={() => setIcon(null)}
              className="h-8 px-3 rounded-control text-[13px] font-medium text-text-secondary"
            >
              Remove
            </button>
          )}
        </div>
        {error ? (
          <span className="text-[11.5px] text-alert">{error}</span>
        ) : (
          <span className="text-[11px] text-text-faint">PNG/JPG/WebP · square · ≤ 80 KB</span>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onPick} className="hidden" />
    </div>
  );
}
