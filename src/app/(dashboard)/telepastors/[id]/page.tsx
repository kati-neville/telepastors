import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireTelepastorAccess } from "@/app/actions/telepastors";
import { TelepastorProfileView } from "@/components/telepastors/telepastor-profile-view";
import { Button } from "@/components/ui/button";

type TelepastorDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TelepastorDetailPage({
  params,
}: TelepastorDetailPageProps) {
  const { id } = await params;
  const { session, telepastor } = await requireTelepastorAccess(id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button
        variant="ghost"
        className="px-0"
        render={<Link href="/telepastors" />}
      >
        <ChevronLeft />
        Back to directory
      </Button>

      <TelepastorProfileView session={session} telepastor={telepastor} />
    </div>
  );
}
