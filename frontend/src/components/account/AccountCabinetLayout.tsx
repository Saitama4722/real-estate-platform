"use client";

import { AccountSidebar } from "@/components/account/AccountSidebar";
import { RequireEmployeeAuth } from "@/components/account/RequireEmployeeAuth";

export function AccountCabinetLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireEmployeeAuth>
      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        <AccountSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </RequireEmployeeAuth>
  );
}
