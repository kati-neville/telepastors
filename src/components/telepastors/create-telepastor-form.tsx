"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createTelepastorAction } from "@/app/actions/telepastors";
import { TelepastorCredentialsDialogHost } from "@/components/telepastors/telepastor-credentials-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTelepastorSchema,
  type CreateTelepastorValues,
} from "@/lib/validations/telepastors";
import type { MinistryRole, TelepastorSummary } from "@/types/domain";

type CreateTelepastorFormProps = {
  governors: TelepastorSummary[];
  leaders: TelepastorSummary[];
  assignableRoles: Array<"GOVERNOR" | "LEADER" | "TELEPASTOR">;
  actorId: string;
  actorRole: MinistryRole;
  actorGovernorId: string | null;
};

const ROLE_LABELS: Record<"GOVERNOR" | "LEADER" | "TELEPASTOR", string> = {
  GOVERNOR: "Governor",
  LEADER: "Leader",
  TELEPASTOR: "Telepastor",
};

export function CreateTelepastorForm({
  governors,
  leaders,
  assignableRoles,
  actorId,
  actorRole,
  actorGovernorId,
}: CreateTelepastorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    id: string;
    name: string;
    phone: string;
    temporaryPassword: string;
  } | null>(null);

  const defaultRole = assignableRoles.includes("TELEPASTOR")
    ? "TELEPASTOR"
    : assignableRoles[0] ?? "TELEPASTOR";

  const form = useForm<CreateTelepastorValues>({
    resolver: zodResolver(createTelepastorSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      role: defaultRole,
      leader_id: actorRole === "LEADER" ? actorId : null,
      governor_id:
        actorRole === "GOVERNOR"
          ? actorId
          : actorRole === "LEADER"
            ? actorGovernorId
            : null,
    },
  });

  const selectedRole = form.watch("role");
  const selectedGovernorId = form.watch("governor_id");

  const filteredLeaders = useMemo(() => {
    if (!selectedGovernorId) {
      return leaders;
    }

    return leaders.filter((leader) => leader.governor_id === selectedGovernorId);
  }, [leaders, selectedGovernorId]);

  const governorItems = useMemo(
    () =>
      governors.map((governor) => ({
        label: governor.name,
        value: governor.id,
      })),
    [governors],
  );

  const leaderItems = useMemo(
    () =>
      filteredLeaders.map((leader) => ({
        label: leader.name,
        value: leader.id,
      })),
    [filteredLeaders],
  );

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createTelepastorAction(values);

      if (!result.success) {
        setServerError(result.error);
        toast.error(result.error);
        return;
      }

      if (
        result.temporaryPassword &&
        result.phone &&
        result.name &&
        result.id
      ) {
        setCredentials({
          id: result.id,
          name: result.name,
          phone: result.phone,
          temporaryPassword: result.temporaryPassword,
        });
        toast.success("Telepastor created. Share the temporary password.");
      } else if (result.id) {
        router.push(`/telepastors/${result.id}`);
        router.refresh();
      }
    });
  });

  return (
    <>
      <TelepastorCredentialsDialogHost
        credentials={credentials}
        onClose={() => setCredentials(null)}
      />

      <form onSubmit={onSubmit} className="space-y-6">
      {serverError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" {...form.register("phone")} />
          {form.formState.errors.phone ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.phone.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" rows={3} {...form.register("address")} />
        {form.formState.errors.address ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.address.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Ministry role</Label>
          <Select
            value={selectedRole}
            onValueChange={(value) => {
              if (!value) return;
              form.setValue("role", value as CreateTelepastorValues["role"]);
              form.setValue(
                "leader_id",
                value === "TELEPASTOR" && actorRole === "LEADER" ? actorId : null,
              );
              form.setValue(
                "governor_id",
                value === "LEADER" && actorRole === "GOVERNOR"
                  ? actorId
                  : value === "TELEPASTOR" && actorRole === "GOVERNOR"
                    ? actorId
                    : value === "TELEPASTOR" && actorRole === "LEADER"
                      ? actorGovernorId
                      : null,
              );
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(selectedRole === "LEADER" || selectedRole === "TELEPASTOR") &&
        actorRole === "SUPER_ADMIN" ? (
          <div className="space-y-2">
            <Label>Governor</Label>
            <Select
              value={form.watch("governor_id") ?? ""}
              items={governorItems}
              onValueChange={(value) => {
                form.setValue("governor_id", value || null);
                if (selectedRole === "TELEPASTOR") {
                  form.setValue("leader_id", null);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select governor" />
              </SelectTrigger>
              <SelectContent>
                {governors.map((governor) => (
                  <SelectItem key={governor.id} value={governor.id}>
                    {governor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.governor_id ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.governor_id.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {selectedRole === "TELEPASTOR" && actorRole !== "LEADER" ? (
          <div className="space-y-2">
            <Label>Leader (optional)</Label>
            <Select
              value={form.watch("leader_id") ?? "__none__"}
              items={[
                { label: "No leader (direct to Governor)", value: "__none__" },
                ...leaderItems,
              ]}
              onValueChange={(value) =>
                form.setValue(
                  "leader_id",
                  !value || value === "__none__" ? null : value,
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Optional leader" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  No leader (direct to Governor)
                </SelectItem>
                {filteredLeaders.map((leader) => (
                  <SelectItem key={leader.id} value={leader.id}>
                    {leader.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leave empty to place this Telepastor directly under the Governor.
              Governors can assign call lists to leaderless Telepastors.
            </p>
            {form.formState.errors.leader_id ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.leader_id.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Creating...
            </>
          ) : (
            "Create Telepastor"
          )}
        </Button>
      </div>
    </form>
    </>
  );
}
