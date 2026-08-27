import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type TelepastorAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TelepastorAvatar({
  name,
  photoUrl,
  size = "default",
  className,
}: TelepastorAvatarProps) {
  return (
    <Avatar size={size} className={cn(className)}>
      {photoUrl ? <AvatarImage src={photoUrl} alt={name} /> : null}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
