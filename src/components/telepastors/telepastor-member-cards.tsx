import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TelepastorAvatar } from "@/components/telepastors/telepastor-avatar";
import {
  ActiveStatusBadge,
  RoleBadge,
} from "@/components/telepastors/telepastor-status-badge";
import type { TelepastorDirectoryEntry } from "@/types/domain";

export function TelepastorMemberCards({
  telepastors,
}: {
  telepastors: TelepastorDirectoryEntry[];
}) {
  return (
    <div className="grid gap-3 md:hidden">
      {telepastors.map((telepastor) => (
        <Link key={telepastor.id} href={`/telepastors/${telepastor.id}`}>
          <Card className="transition-colors hover:bg-muted/30">
            <CardContent className="flex items-start gap-3 p-4">
              <TelepastorAvatar
                name={telepastor.name}
                photoUrl={telepastor.profile_picture_url}
                size="lg"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{telepastor.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {telepastor.phone}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {telepastor.address ?? "No address provided"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <RoleBadge role={telepastor.role} />
                  <ActiveStatusBadge isActive={telepastor.is_active} />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
