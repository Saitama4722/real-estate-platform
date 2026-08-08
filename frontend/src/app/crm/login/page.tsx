import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Вход в CRM — Centreal",
  description: "Вход для сотрудников Centreal: объекты, заявки и клиенты.",
  robots: { index: false, follow: false },
};

/**
 * Legacy entry point. Renders the identical shell and form as
 * /account/login — both post to the same endpoint and land on /account.
 */
export default function CrmLoginPage() {
  return (
    <AuthShell>
      <SignInForm />
    </AuthShell>
  );
}
