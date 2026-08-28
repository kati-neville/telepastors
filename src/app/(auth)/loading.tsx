import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div
      className="flex min-h-full flex-1 items-center justify-center px-4 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-16 w-48" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
