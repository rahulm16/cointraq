"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/ui";

const options = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? theme ?? "dark" : "dark";

  return (
    <div className="inline-flex p-1 rounded-control bg-surface-raised border border-border gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => setTheme(o.value)}
          className={cn(
            "h-8 px-3 rounded-[6px] text-[13px] font-medium",
            current === o.value ? "bg-primary text-primary-contrast" : "text-text-secondary",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
