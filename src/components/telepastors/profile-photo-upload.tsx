"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadProfilePhotoAction } from "@/app/actions/telepastors";
import { TelepastorAvatar } from "@/components/telepastors/telepastor-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  PROFILE_PHOTO_ACCEPT,
  PROFILE_PHOTO_MAX_BYTES,
} from "@/lib/validations/telepastors";

export function ProfilePhotoUpload({
  telepastorId,
  name,
  photoUrl,
}: {
  telepastorId: string;
  name: string;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(photoUrl);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!PROFILE_PHOTO_ACCEPT.split(",").includes(file.type)) {
      toast.error("Photo must be a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > PROFILE_PHOTO_MAX_BYTES) {
      toast.error("Photo must be 2MB or smaller.");
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));

    const formData = new FormData();
    formData.set("telepastorId", telepastorId);
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadProfilePhotoAction(formData);

      if (!result.success) {
        toast.error(result.error);
        setPreviewUrl(photoUrl);
        return;
      }

      toast.success("Profile photo updated");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <TelepastorAvatar name={name} photoUrl={previewUrl} size="lg" />
      <div className="space-y-2">
        <Label htmlFor={`photo-${telepastorId}`}>Profile photo</Label>
        <input
          ref={inputRef}
          id={`photo-${telepastorId}`}
          type="file"
          accept={PROFILE_PHOTO_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload />
              Upload photo
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, or WebP up to 2MB.
        </p>
      </div>
    </div>
  );
}
