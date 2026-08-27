"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createTelepastorAction } from "@/app/actions/telepastors";
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
import type { TelepastorSummary } from "@/types/domain";

type CreateTelepastorFormProps = {
  governors: TelepastorSummary[];
  leaders: TelepastorSummary[];
};

export function CreateTelepastorForm({
  governors,
  leaders,
}: CreateTelepastorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateTelepastorValues>({
    resolver: zodResolver(createTelepastorSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      role: "TELEPASTOR",
      leader_id: null,
      governor_id: null,
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

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createTelepastorAction(values);

      if (!result.success) {
        setServerError(result.error);
        toast.error(result.error);
      }
    });
  });

  return (
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
              form.setValue("leader_id", null);
              form.setValue("governor_id", null);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TELEPASTOR">Telepastor</SelectItem>
              <SelectItem value="LEADER">Leader</SelectItem>
              <SelectItem value="GOVERNOR">Governor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedRole === "LEADER" ? (
          <div className="space-y-2">
            <Label>Governor</Label>
            <Select
              value={form.watch("governor_id") ?? ""}
              onValueChange={(value) =>
                form.setValue("governor_id", value || null)
              }
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

        {selectedRole === "TELEPASTOR" ? (
          <div className="space-y-2">
            <Label>Leader</Label>
            <Select
              value={form.watch("leader_id") ?? ""}
              onValueChange={(value) =>
                form.setValue("leader_id", value || null)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select leader" />
              </SelectTrigger>
              <SelectContent>
                {filteredLeaders.map((leader) => (
                  <SelectItem key={leader.id} value={leader.id}>
                    {leader.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
  );
}
