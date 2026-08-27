"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import {
  saveWhatsAppTemplateAction,
  setDefaultWhatsAppTemplateAction,
} from "@/app/actions/whatsapp-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { WhatsAppMessageTemplate } from "@/types/domain";

type WhatsAppTemplatesManagerProps = {
  templates: WhatsAppMessageTemplate[];
  canManage: boolean;
};

export function WhatsAppTemplatesManager({
  templates,
  canManage,
}: WhatsAppTemplatesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSlug("");
    setBody("");
    setIsActive(true);
    setIsDefault(false);
  };

  const startEdit = (template: WhatsAppMessageTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setSlug(template.slug);
    setBody(template.body);
    setIsActive(template.is_active);
    setIsDefault(template.is_default);
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveWhatsAppTemplateAction(
        { name, slug, body, isActive, isDefault },
        editingId ?? undefined,
      );

      if (!result.success) {
        toast.error(result.error ?? "Failed to save template.");
        return;
      }

      toast.success(editingId ? "Template updated." : "Template created.");
      resetForm();
      router.refresh();
    });
  };

  const handleSetDefault = (templateId: string) => {
    startTransition(async () => {
      const result = await setDefaultWhatsAppTemplateAction(templateId);
      if (!result.success) {
        toast.error(result.error ?? "Failed to set default.");
        return;
      }
      toast.success("Default template updated.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          WhatsApp message templates
        </h2>
        <p className="text-sm text-muted-foreground">
          Pre-filled messages for telepastors to copy into WhatsApp manually. No
          automated WhatsApp sending is enabled.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {template.is_default ? (
                      <Badge>Default</Badge>
                    ) : null}
                    {!template.is_active ? (
                      <Badge variant="outline">Inactive</Badge>
                    ) : null}
                  </div>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    {!template.is_default ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleSetDefault(template.id)}
                      >
                        <Star />
                        Set default
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => startEdit(template)}
                    >
                      Edit
                    </Button>
                  </div>
                ) : null}
              </div>
              <CardDescription>{template.slug}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
                {template.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit template" : "New template"}</CardTitle>
            <CardDescription>
              Use {"{name}"} and {"{campaign}"} placeholders where helpful.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Service reminder"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-slug">Slug</Label>
                <Input
                  id="template-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="service-reminder"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-body">Message body</Label>
              <Textarea
                id="template-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={4}
              />
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                Default template
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                disabled={isPending || !name.trim() || !slug.trim() || !body.trim()}
                onClick={handleSave}
              >
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving...
                  </>
                ) : editingId ? (
                  "Update template"
                ) : (
                  "Create template"
                )}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={resetForm}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
