import { UserMenu } from "@/components/layout/user-menu";
import type { Telepastor } from "@/types/domain";

type HeaderAccountMenuProps = {
  telepastor: Telepastor;
  email: string;
};

export function HeaderAccountMenu({ telepastor, email }: HeaderAccountMenuProps) {
  return <UserMenu telepastor={telepastor} email={email} />;
}
