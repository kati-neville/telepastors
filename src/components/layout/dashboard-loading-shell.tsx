import { Skeleton } from "@/components/ui/skeleton";

export function DashboardLoadingShell() {
  return (
    <div className="flex h-dvh overflow-hidden" aria-busy="true" aria-live="polite">
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-16 shrink-0 items-center border-b px-4">
          <Skeleton className="h-10 w-36" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg" />
          ))}
        </nav>
        <div className="border-t p-4">
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 md:px-6">
          <Skeleton className="size-9 rounded-lg md:hidden" />
          <Skeleton className="hidden h-5 w-40 md:block" />
          <Skeleton className="ml-auto size-9 rounded-full" />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:pb-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-28 rounded-xl" />
              ))}
            </div>

            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </main>
      </div>

      <span className="sr-only">Loading workspace</span>
    </div>
  );
}
