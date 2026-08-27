import type { ReactNode } from "react";

type PlaceholderPageProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function PlaceholderPage({
  title,
  description,
  children,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-2">
      <h2 className="font-heading text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="max-w-2xl text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
