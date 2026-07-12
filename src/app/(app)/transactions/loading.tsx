import { Skeleton } from "@/components/skeleton";

// Transactions list skeleton (SPEC §13).
export default function Loading() {
  return (
    <main className="max-w-[900px] mx-auto p-4 lg:p-8 flex flex-col gap-4">
      <Skeleton className="h-8 w-40 mx-auto" />
      <Skeleton className="h-10" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-10" />
      {[0, 1, 2].map((g) => (
        <div key={g} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-[120px]" />
        </div>
      ))}
    </main>
  );
}
