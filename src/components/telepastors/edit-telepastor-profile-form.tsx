"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateTelepastorProfileAction } from "@/app/actions/telepastors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  updateTelepastorProfileSchema,
  type UpdateTelepastorProfileValues,
} from "@/lib/validations/telepastors";
import type { TelepastorDetail } from "@/types/domain";

export function EditTelepastorProfileForm({
  telepastor,
  redirectPath,
  showCancel = true,
}: {
  telepastor: TelepastorDetail;
  redirectPath?: string;
  showCancel?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const successPath = redirectPath ?? `/telepastors/${telepastor.id}`;
  const cancelPath = `/telepastors/${telepastor.id}`;

  const form = useForm<UpdateTelepastorProfileValues>({
    resolver: zodResolver(updateTelepastorProfileSchema),
    defaultValues: {
      name: telepastor.name,
      phone: telepastor.phone,
      address: telepastor.address ?? "",
      date_of_birth: telepastor.date_of_birth ?? "",
      occupation: telepastor.occupation ?? "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await updateTelepastorProfileAction(telepastor.id, values);

      if (!result.success) {
        setServerError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success("Profile updated");
      router.push(successPath);
      router.refresh();
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

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Location / address</Label>
          <Textarea
            id="address"
            rows={3}
            placeholder="City, area, or full address"
            {...form.register("address")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date_of_birth">Date of birth</Label>
          <Input id="date_of_birth" type="date" {...form.register("date_of_birth")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="occupation">Occupation</Label>
          <Input id="occupation" {...form.register("occupation")} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {showCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(cancelPath)}
            disabled={isPending}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Saving...
            </>
          ) : (
            "Save profile"
          )}
        </Button>
      </div>
    </form>
  );
}
