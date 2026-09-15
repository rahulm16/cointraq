import { Dock, Sidebar } from "@/components/nav";
import { AppToaster } from "@/components/app-toaster";
import { CommandPalette } from "@/components/command-palette";

// Every authed page reads per-request data (DB, cookies); never prerender them.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* data-vaul-drawer-wrapper: vaul scales this back iOS-style behind sheets (§4) */}
      <div data-vaul-drawer-wrapper="" className="min-h-dvh bg-background">
        <Sidebar />
        {/* Offset follows the rail (68px collapsed / 256px pinned); animates on pin. */}
        <div
          className="min-w-0 lg:pl-[var(--sidebar-offset)] pb-[calc(112px+env(safe-area-inset-bottom))] lg:pb-0"
          style={{ transition: "padding-left 400ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          {children}
        </div>
        <Dock />
      </div>
      <AppToaster />
      <CommandPalette />
    </>
  );
}
