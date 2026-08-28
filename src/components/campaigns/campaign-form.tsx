"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createCampaignAction,
  updateCampaignAction,
} from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
  CAMPAIGN_STATUSES,
  campaignFormSchema,
  type CampaignFormValues,
} from "@/lib/validations/campaigns";
import { getCampaignStatusLabel } from "@/lib/campaigns/format";
import type { Campaign } from "@/types/domain";

type CampaignFormProps = {
  campaign?: Campaign;
};

export function CampaignForm({ campaign }: CampaignFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEditing = Boolean(campaign);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: campaign?.name ?? "",
      description: campaign?.description ?? "",
      event_date: campaign?.event_date ?? "",
      status: campaign?.status ?? "DRAFT",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = isEditing
        ? await updateCampaignAction(campaign!.id, values)
        : await createCampaignAction(values);

      if (!result.success) {
        setServerError(result.error);
        toast.error(result.error);
        return;
      }

      if (isEditing) {
        toast.success("Campaign updated");
        router.push(`/campaigns/${campaign!.id}`);
        router.refresh();
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

      <div className="space-y-2">
        <Label htmlFor="name">Campaign name</Label>
        <Input id="name" placeholder="Sunday Service Reminder" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          placeholder="Describe the purpose of this calling exercise"
          {...form.register("description")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="event_date">Event / follow-up date</Label>
          <DatePicker
            id="event_date"
            value={form.watch("event_date") ?? ""}
            onChange={(value) =>
              form.setValue("event_date", value, { shouldDirty: true })
            }
            placeholder="Select event date"
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={form.watch("status")}
            onValueChange={(value) => {
              if (!value) return;
              form.setValue("status", value as CampaignFormValues["status"]);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {getCampaignStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              Saving...
            </>
          ) : isEditing ? (
            "Save changes"
          ) : (
            "Create campaign"
          )}
        </Button>
      </div>
    </form>
  );
}
