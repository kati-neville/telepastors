import Link from "next/link";
import { Cake, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TelepastorAvatar } from "@/components/telepastors/telepastor-avatar";
import { RoleBadge } from "@/components/telepastors/telepastor-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BirthdayEntry } from "@/types/domain";

type BirthdaysListProps = {
  birthdays: BirthdayEntry[];
  summaryLabel: string;
};

export function BirthdaysList({ birthdays, summaryLabel }: BirthdaysListProps) {
  if (birthdays.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
          <Cake className="size-5 text-muted-foreground" />
        </div>
        <h3 className="font-heading text-base font-semibold">
          No birthdays in {summaryLabel}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          No telepastors with a recorded birthday match this filter. Try another
          month or quarter, or ask members to complete their profile.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden rounded-xl border bg-card shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Birthday</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Leader</TableHead>
              <TableHead>Governor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {birthdays.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Link
                    href={`/telepastors/${entry.id}`}
                    className="flex items-center gap-3 font-medium hover:underline"
                  >
                    <TelepastorAvatar
                      name={entry.name}
                      photoUrl={entry.profile_picture_url}
                      size="sm"
                    />
                    {entry.name}
                  </Link>
                </TableCell>
                <TableCell>{entry.birthdayLabel}</TableCell>
                <TableCell>{entry.age}</TableCell>
                <TableCell>
                  <RoleBadge role={entry.role} />
                </TableCell>
                <TableCell>{entry.leader_name ?? "—"}</TableCell>
                <TableCell>{entry.governor_name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {birthdays.map((entry) => (
          <Link key={entry.id} href={`/telepastors/${entry.id}`}>
            <Card className="transition-colors hover:bg-muted/30">
              <CardContent className="flex items-start gap-3 p-4">
                <TelepastorAvatar
                  name={entry.name}
                  photoUrl={entry.profile_picture_url}
                  size="lg"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{entry.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.birthdayLabel} · age {entry.age}
                      </p>
                    </div>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <RoleBadge role={entry.role} />
                  </div>
                  {(entry.leader_name || entry.governor_name) && (
                    <p className="text-xs text-muted-foreground">
                      {[entry.leader_name, entry.governor_name]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
