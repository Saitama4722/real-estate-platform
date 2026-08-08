import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForcedPasswordChangeForm } from "@/components/auth/ForcedPasswordChangeForm";

export const metadata: Metadata = {
  title: "Смена пароля — Centreal",
  robots: { index: false, follow: false },
};

/**
 * Lives OUTSIDE `account/(cabinet)` on purpose: the cabinet layout redirects
 * anyone carrying `must_change_password` here, so hosting this page inside it
 * would be a redirect loop.
 */
export default function ForcedPasswordChangePage() {
  return (
    <AuthShell>
      <ForcedPasswordChangeForm />
    </AuthShell>
  );
}
