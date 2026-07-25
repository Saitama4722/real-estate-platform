import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CRM_ACCESS_COOKIE_NAME } from "@/lib/crmAuthConstants";
import { AccountCabinetLayout } from "@/components/account/AccountCabinetLayout";

/**
 * Server-side auth gate for the whole `/account/(cabinet)` group.
 *
 * This replaces the former Edge `middleware.ts` gate: Next runs middleware in the
 * Edge runtime, whose VM sandbox forbids the eval-based module wrapping that
 * Next's dev webpack emits — which threw "EvalError: Code generation from strings
 * disallowed" and 500'd every /account/* page in dev. This layout runs in the
 * Node.js server runtime (no eval restriction) and performs the identical check:
 * redirect a cookie-less visitor to /account/login before any cabinet page
 * renders. `/account/login` lives OUTSIDE this route group, so it is never gated.
 * Client-side `RequireEmployeeAuth` still validates the token against /api/auth/me
 * as the authoritative check.
 */
export default async function AccountCabinetRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get(CRM_ACCESS_COOKIE_NAME)?.value;
  if (!token?.trim()) {
    redirect("/account/login");
  }
  return <AccountCabinetLayout>{children}</AccountCabinetLayout>;
}
