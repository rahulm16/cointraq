import { Skeleton } from "@/components/skeleton";

// Dashboard skeleton (SPEC §13).
export default function Loading() {
  return (
    <main className="max-w-[1120px] mx-auto p-4 lg:p-8">
      <Skeleton className="h-8 w-40 mx-auto mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Skeleton className="h-[132px] rounded-[24px]" />
          <div className="grid grid-cols-3 gap-2.5">
            <Skeleton className="h-16 rounded-card" />
            <Skeleton className="h-16 rounded-card" />
            <Skeleton className="h-16 rounded-card" />
          </div>
          <Skeleton className="h-[180px] rounded-card" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-[180px] rounded-card" />
            <Skeleton className="h-[180px] rounded-card" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[220px] rounded-card" />
          <Skeleton className="h-[280px] rounded-card" />
        </div>
      </div>
    </main>
  );
}
