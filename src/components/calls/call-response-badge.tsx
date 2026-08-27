import { Badge } from "@/components/ui/badge";
import { CALL_RESPONSE_LABELS } from "@/lib/config/calling";
import type { CallResponse } from "@/types/domain";

const VARIANT: Record<
  CallResponse,
  "default" | "secondary" | "outline" | "destructive"
> = {
  COMING: "default",
  NOT_COMING: "secondary",
  UNREACHABLE: "outline",
  WRONG_NUMBER: "destructive",
  OTHER: "secondary",
};

export function CallResponseBadge({ response }: { response: CallResponse }) {
  return (
    <Badge variant={VARIANT[response]}>{CALL_RESPONSE_LABELS[response]}</Badge>
  );
}
