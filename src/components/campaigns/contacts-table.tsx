import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssignmentStatusBadge } from "@/components/assignments/assignment-status-badge";
import type { ContactWithAssignee } from "@/types/domain";

export function ContactsTable({
  contacts,
}: {
  contacts: ContactWithAssignee[];
}) {
  return (
    <div className="hidden rounded-xl border bg-card shadow-sm md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned to</TableHead>
            <TableHead>Imported</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell className="font-medium">{contact.name}</TableCell>
              <TableCell>{contact.phone}</TableCell>
              <TableCell>
                <AssignmentStatusBadge status={contact.assignment_status} />
              </TableCell>
              <TableCell>{contact.assignee_name ?? "Unassigned"}</TableCell>
              <TableCell>
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                }).format(new Date(contact.created_at))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ContactsEmptyState() {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
      <h3 className="font-heading text-lg font-semibold">No contacts yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Import an Excel contact list to populate this campaign.
      </p>
    </div>
  );
}
