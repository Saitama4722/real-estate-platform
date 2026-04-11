import { Container } from "@/components/layout/container";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-200 bg-slate-50 py-8">
      <Container>{children}</Container>
    </div>
  );
}
