import { Skeleton } from "@/components/skeleton";

// Dashboard skeleton (SPEC §13).
export default function Loading() {
  return (
    <main className="max-w-[1120px] mx-auto p-4 lg:p-8">
      <Skeleton className="h-8 w-40 mx-auto mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Skeleton className="h-[132px] rounded-[18px]" />
          <div className="grid grid-cols-3 gap-2.5">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-[180px]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-[180px]" />
            <Skeleton className="h-[180px]" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[280px]" />
        </div>
      </div>
    </main>
  );
}
