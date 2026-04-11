"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { EmployeeUser } from "@/lib/employeeUser";

const EmployeeUserContext = createContext<EmployeeUser | null>(null);

export function EmployeeUserProvider({
  user,
  children,
}: {
  user: EmployeeUser;
  children: ReactNode;
}) {
  return <EmployeeUserContext.Provider value={user}>{children}</EmployeeUserContext.Provider>;
}

export function useEmployeeUser(): EmployeeUser {
  const u = useContext(EmployeeUserContext);
  if (!u) {
    throw new Error("useEmployeeUser: используйте только внутри кабинета сотрудника после входа.");
  }
  return u;
}
