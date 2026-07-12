"use client";

import { GhostButton } from "@/components/form";

export function ExportButton() {
  return (
    <a href="/export" download>
      <GhostButton type="button">Download CSV zip</GhostButton>
    </a>
  );
}
