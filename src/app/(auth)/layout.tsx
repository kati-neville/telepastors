export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-full overflow-y-auto overscroll-y-contain bg-muted/30">
      {children}
    </div>
  );
}
