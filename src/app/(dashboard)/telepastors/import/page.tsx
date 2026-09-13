import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TelepastorImportWizard } from "@/components/telepastors/telepastor-import-wizard";
import { Button } from "@/components/ui/button";
import { enforcePageAccess } from "@/lib/auth/guards";
import { canBulkImportTelepastors } from "@/lib/auth/permissions";
import { requireAuthSession } from "@/lib/auth/session";

export default async function TelepastorImportPage() {
  await enforcePageAccess("/telepastors");
  const session = await requireAuthSession();

  if (!canBulkImportTelepastors({ telepastor: session.telepastor })) {
    redirect("/telepastors");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button
        variant="ghost"
        className="px-0"
        render={<Link href="/telepastors" />}
      >
        <ChevronLeft />
        Back to directory
      </Button>

      <TelepastorImportWizard />
    </div>
  );
}
