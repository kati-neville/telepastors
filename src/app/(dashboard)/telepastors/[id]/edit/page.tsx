import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  requireTelepastorEditAccess,
} from "@/app/actions/telepastors";
import { ActiveStatusSection } from "@/components/telepastors/active-status-section";
import { DeleteTelepastorSection } from "@/components/telepastors/delete-telepastor-section";
import { EditTelepastorProfileForm } from "@/components/telepastors/edit-telepastor-profile-form";
import { ProfilePhotoUpload } from "@/components/telepastors/profile-photo-upload";
import { RoleManagementSection } from "@/components/telepastors/role-management-section";
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
  canDeleteTelepastor,
  canToggleTelepastorActive,
} from "@/lib/auth/permissions";
import {
  fetchGovernorOptions,
  fetchLeaderOptions,
} from "@/lib/queries/telepastors";

type EditTelepastorPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTelepastorPage({
  params,
}: EditTelepastorPageProps) {
  const { id } = await params;
  const { session, telepastor } = await requireTelepastorEditAccess(id);
  const context = { telepastor: session.telepastor };

  const [governors, leaders] = await Promise.all([
    canChangeRole(context) ? fetchGovernorOptions() : Promise.resolve([]),
    fetchLeaderOptions(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button
        variant="ghost"
        className="px-0"
        render={<Link href={`/telepastors/${telepastor.id}`} />}
      >
        <ChevronLeft />
        Back to profile
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Edit profile</CardTitle>
          <CardDescription>
            Update contact details and extended profile information for{" "}
            {telepastor.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <ProfilePhotoUpload
            telepastorId={telepastor.id}
            name={telepastor.name}
            photoUrl={telepastor.profile_picture_url}
          />
          <Separator />
          <EditTelepastorProfileForm telepastor={telepastor} />
        </CardContent>
      </Card>

      {canChangeRole(context) && telepastor.role !== "SUPER_ADMIN" ? (
        <RoleManagementSection
          telepastor={telepastor}
          governors={governors}
          leaders={leaders}
        />
      ) : null}

      {canToggleTelepastorActive(context, telepastor) &&
      telepastor.role !== "SUPER_ADMIN" ? (
        <ActiveStatusSection telepastor={telepastor} />
      ) : null}

      {canDeleteTelepastor(context, telepastor) ? (
        <DeleteTelepastorSection telepastor={telepastor} />
      ) : null}
    </div>
  );
}
