import { requireProfileAccess } from "@/app/actions/telepastors";
import { EditTelepastorProfileForm } from "@/components/telepastors/edit-telepastor-profile-form";
import { ProfilePhotoUpload } from "@/components/telepastors/profile-photo-upload";
import { RoleBadge } from "@/components/telepastors/telepastor-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getRoleLabel } from "@/lib/auth/roles";
import {
  formatMissingProfileFields,
  getMissingProfileFields,
} from "@/lib/profile/completeness";

export default async function ProfilePage() {
  const { session, telepastor } = await requireProfileAccess();
  const missingFields = getMissingProfileFields(telepastor);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          My profile
        </h2>
        <p className="text-sm text-muted-foreground">
          Keep your contact details up to date so your ministry team can reach
          you and you can work smoothly across the app.
        </p>
      </div>

      {missingFields.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          Complete your profile by adding your{" "}
          {formatMissingProfileFields(missingFields)}.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your sign-in and ministry role</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{session.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ministry role</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <RoleBadge role={telepastor.role} />
              <span className="text-muted-foreground">
                {getRoleLabel(telepastor.role)}
              </span>
            </div>
          </div>
          {telepastor.leader ? (
            <div>
              <p className="text-muted-foreground">Leader</p>
              <p className="font-medium">{telepastor.leader.name}</p>
            </div>
          ) : null}
          {telepastor.governor ? (
            <div>
              <p className="text-muted-foreground">Governor</p>
              <p className="font-medium">{telepastor.governor.name}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal details</CardTitle>
          <CardDescription>
            Update your photo, contact information, date of birth, and location.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <ProfilePhotoUpload
            telepastorId={telepastor.id}
            name={telepastor.name}
            photoUrl={telepastor.profile_picture_url}
          />
          <Separator />
          <EditTelepastorProfileForm
            telepastor={telepastor}
            redirectPath="/profile"
            showCancel={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
