"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearCrmTokens } from "@/lib/crmAuth";

export function AccountEmployeeToolbar() {
  const router = useRouter();

  const logout = () => {
    clearCrmTokens();
    router.replace("/account/login");
    router.refresh();
  };

  return (
    <div className="mb-6 flex justify-end">
      <Button type="button" variant="outline" onClick={logout}>
        Выйти
      </Button>
    </div>
  );
}
