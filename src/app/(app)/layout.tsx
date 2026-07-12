import { BottomNav, Sidebar } from "@/components/nav";
import { ToastProvider } from "@/components/toast";

// Every authed page reads per-request data (DB, cookies); never prerender them.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-dvh bg-background">
        {/* Floating fixed sidebar (desktop). Content is offset by its width. */}
        <Sidebar />
        <div className="min-w-0 pb-[86px] lg:pb-0 lg:pl-[248px]">{children}</div>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
