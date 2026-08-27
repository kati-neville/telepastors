import Link from "next/link";
import { Pencil } from "lucide-react";
import { ActiveStatusSection } from "@/components/telepastors/active-status-section";
import { TelepastorAvatar } from "@/components/telepastors/telepastor-avatar";
import {
  ActiveStatusBadge,
  RoleBadge,
} from "@/components/telepastors/telepastor-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  canChangeRole,
  canEditTelepastorProfile,
  canManageTelepastor,
  canToggleTelepastorActive,
} from "@/lib/auth/permissions";
import type { AuthSession, TelepastorDetail } from "@/types/domain";

function formatDate(value: string | null) {
  if (!value) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function TelepastorProfileView({
  session,
  telepastor,
}: {
  session: AuthSession;
  telepastor: TelepastorDetail;
}) {
  const context = { telepastor: session.telepastor };
  const canEdit = canEditTelepastorProfile(context, telepastor);
  const canManage = canManageTelepastor(context, telepastor);
  const canToggle = canToggleTelepastorActive(context, telepastor);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <TelepastorAvatar
            name={telepastor.name}
            photoUrl={telepastor.profile_picture_url}
            size="lg"
            className="size-16"
          />
          <div className="space-y-2">
            <div>
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                {telepastor.name}
              </h2>
              <p className="text-sm text-muted-foreground">{telepastor.phone}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <RoleBadge role={telepastor.role} />
              <ActiveStatusBadge isActive={telepastor.is_active} />
            </div>
          </div>
        </div>

        {canEdit ? (
          <Button render={<Link href={`/telepastors/${telepastor.id}/edit`} />}>
            <Pencil />
            Edit profile
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact details</CardTitle>
            <CardDescription>Basic ministry member information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Address</p>
              <p className="font-medium">{telepastor.address ?? "Not provided"}</p>
            </div>
            <Separator />
            <div>
              <p className="text-muted-foreground">Date of birth</p>
              <p className="font-medium">{formatDate(telepastor.date_of_birth)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Occupation</p>
              <p className="font-medium">
                {telepastor.occupation ?? "Not provided"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ministry placement</CardTitle>
            <CardDescription>Role and organizational relationships</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Ministry role</p>
              <div className="mt-1">
                <RoleBadge role={telepastor.role} />
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-muted-foreground">Leader</p>
              <p className="font-medium">
                {telepastor.leader?.name ?? "Not assigned"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Governor</p>
              <p className="font-medium">
                {telepastor.governor?.name ?? "Not assigned"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {canToggle && telepastor.role !== "SUPER_ADMIN" ? (
        <ActiveStatusSection telepastor={telepastor} />
      ) : null}

      {canChangeRole(context) ? (
        <p className="text-sm text-muted-foreground">
          Ministry role changes are managed on the edit page in the dedicated
          role section.
        </p>
      ) : null}

      {canManage ? (
        <p className="text-sm text-muted-foreground">
          Profile photos and extended details can be updated from the edit page.
        </p>
      ) : null}
    </div>
  );
}
