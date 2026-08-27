import { Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AssignmentStatusBadge } from "@/components/assignments/assignment-status-badge";
import type { ContactWithAssignee } from "@/types/domain";

export function ContactCards({ contacts }: { contacts: ContactWithAssignee[] }) {
  return (
    <div className="grid gap-3 md:hidden">
      {contacts.map((contact) => (
        <Card key={contact.id}>
          <CardContent className="space-y-2 p-4">
            <p className="font-medium">{contact.name}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="size-3.5" />
              <span>{contact.phone}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <AssignmentStatusBadge status={contact.assignment_status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Assigned to: {contact.assignee_name ?? "Unassigned"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
