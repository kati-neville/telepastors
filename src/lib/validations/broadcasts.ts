import { z } from "zod";
import { BROADCAST_RECIPIENT_SCOPES, CALL_RESPONSES } from "@/types/domain";

export type BroadcastRecipientScope = (typeof BROADCAST_RECIPIENT_SCOPES)[number];

export const broadcastComposerSchema = z
  .object({
    message: z.string().trim().min(1, "Message is required.").max(1600),
    scope: z.enum(BROADCAST_RECIPIENT_SCOPES),
    campaignId: z.string().uuid().optional(),
    governorId: z.string().uuid().optional(),
    leaderId: z.string().uuid().optional(),
    telepastorId: z.string().uuid().optional(),
    response: z.enum(CALL_RESPONSES).optional(),
    contactIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((values, ctx) => {
    if (
      (values.scope === "CAMPAIGN" ||
        values.scope === "SELECTED_CONTACTS" ||
        values.scope === "RESPONSE_TYPE") &&
      !values.campaignId
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Select a campaign for this recipient group.",
        path: ["campaignId"],
      });
    }

    if (values.scope === "SELECTED_CONTACTS" && !values.contactIds?.length) {
      ctx.addIssue({
        code: "custom",
        message: "Select at least one contact.",
        path: ["contactIds"],
      });
    }

    if (values.scope === "RESPONSE_TYPE" && !values.response) {
      ctx.addIssue({
        code: "custom",
        message: "Select a response type.",
        path: ["response"],
      });
    }
  });

export type BroadcastComposerValues = z.infer<typeof broadcastComposerSchema>;

export const whatsAppTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens."),
  body: z.string().trim().min(1, "Message body is required.").max(1000),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type WhatsAppTemplateValues = z.infer<typeof whatsAppTemplateSchema>;
