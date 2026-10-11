import { Skeleton } from "@/components/ui/bits";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-label="Carregando">
      <div className="flex h-[var(--topbar)] items-center gap-4 border-b border-border px-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="ml-auto h-8 w-28" />
      </div>
      <div className="flex flex-1 gap-2 bg-canvas p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex w-[var(--kanban-column)] shrink-0 flex-col gap-2">
            <Skeleton className="h-14 w-full bg-bg" />
            <Skeleton className="h-28 w-full bg-bg" />
            <Skeleton className="h-28 w-full bg-bg" />
          </div>
        ))}
      </div>
    </div>
  );
}
