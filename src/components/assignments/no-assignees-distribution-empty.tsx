import Link from "next/link";
import { FileSpreadsheet, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAssigneeLabel } from "@/lib/auth/assignments";
import type { MinistryRole } from "@/types/domain";

type NoAssigneesDistributionEmptyProps = {
  actorRole: MinistryRole;
  title: string;
  readyContactCount?: number;
};

function getEmptyCopy(actorRole: MinistryRole, readyContactCount: number) {
  const assigneeLabel = getAssigneeLabel(actorRole);
  const assigneeLabelPlural = `${assigneeLabel.toLowerCase()}s`;
  const underYou =
    actorRole === "LEADER"
      ? "telepastors under you"
      : actorRole === "GOVERNOR"
        ? "leaders or telepastors under you"
        : "governors in the ministry";

  const hasReadyContacts = readyContactCount > 0;

  if (actorRole === "SUPER_ADMIN") {
    return {
      description: hasReadyContacts
        ? `You have ${readyContactCount} contact${readyContactCount === 1 ? "" : "s"} ready to assign, but there are no governors available yet. Add governors before you can distribute.`
        : `No ${assigneeLabelPlural} are available yet. Add governors before you can distribute contacts.`,
      createLabel: "Add governor",
      showCreate: true,
      showImport: true,
    };
  }

  return {
    description: hasReadyContacts
        ? `You have ${readyContactCount} contact${readyContactCount === 1 ? "" : "s"} ready to assign, but you don't have any ${underYou} yet. Add them to your team to share these contacts.`
        : `No ${assigneeLabelPlural} are available in your organization yet. Add ${underYou} before you can distribute contacts.`,
    createLabel:
      actorRole === "LEADER"
        ? "Add telepastor"
        : actorRole === "GOVERNOR"
          ? "Add leader or telepastor"
          : "Add team member",
    showCreate: true,
    showImport: true,
  };
}

export function NoAssigneesDistributionEmpty({
  actorRole,
  title,
  readyContactCount = 0,
}: NoAssigneesDistributionEmptyProps) {
  const copy = getEmptyCopy(actorRole, readyContactCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      {copy.showCreate || copy.showImport ? (
        <CardContent className="flex flex-wrap gap-2">
          {copy.showCreate ? (
            <Button render={<Link href="/telepastors/new" />}>
              <UserPlus />
              {copy.createLabel}
            </Button>
          ) : null}
          {copy.showImport ? (
            <Button
              variant="outline"
              render={<Link href="/telepastors/import" />}
            >
              <FileSpreadsheet />
              Import telepastors
            </Button>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
