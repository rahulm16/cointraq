"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-[60dvh] flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-[15px] font-semibold text-text-primary">Something went wrong</div>
      <p className="text-[13px] text-text-secondary max-w-xs">
        That didn&apos;t load. Check your database connection and try again.
      </p>
      <button
        onClick={reset}
        className="h-10 px-4 rounded-control bg-primary text-primary-contrast font-semibold text-[14px]"
      >
        Retry
      </button>
    </main>
  );
}
