import { Loader2 } from "lucide-react";

type AuthRedirectOverlayProps = {
  message: string;
};

export function AuthRedirectOverlay({ message }: AuthRedirectOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border bg-card px-8 py-10 text-center shadow-lg">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
}
