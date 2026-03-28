export default function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
