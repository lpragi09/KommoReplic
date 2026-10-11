import { Skeleton } from "@/components/ui/bits";

export default function Loading() {
  return (
    <div className="flex flex-1" aria-busy="true" aria-label="Carregando lead">
      <div className="hidden w-[var(--entity-panel)] flex-col gap-3 border-r border-border p-4 lg:flex">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="flex flex-1 flex-col gap-3 bg-surface p-4">
        <Skeleton className="h-12 w-2/3 bg-bg" />
        <Skeleton className="ml-auto h-12 w-1/2 bg-bg" />
        <Skeleton className="h-16 w-full bg-bg" />
      </div>
    </div>
  );
}
