import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Вход в личный кабинет — Centreal",
  description: "Вход для сотрудников Centreal: объекты, заявки и клиенты.",
  robots: { index: false, follow: false },
};

export default function AccountLoginPage() {
  return (
    <AuthShell>
      <SignInForm />
    </AuthShell>
  );
}
