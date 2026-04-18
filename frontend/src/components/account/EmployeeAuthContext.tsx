"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { EmployeeUser } from "@/lib/employeeUser";

type EmployeeUserContextValue = {
  user: EmployeeUser;
  setUser: (user: EmployeeUser) => void;
};

const EmployeeUserContext = createContext<EmployeeUserContextValue | null>(null);

export function EmployeeUserProvider({
  user,
  setUser,
  children,
}: {
  user: EmployeeUser;
  setUser: (user: EmployeeUser) => void;
  children: ReactNode;
}) {
  return (
    <EmployeeUserContext.Provider value={{ user, setUser }}>
      {children}
    </EmployeeUserContext.Provider>
  );
}

export function useEmployeeUser(): EmployeeUser {
  const ctx = useContext(EmployeeUserContext);
  if (!ctx) {
    throw new Error("useEmployeeUser: используйте только внутри кабинета сотрудника после входа.");
  }
  return ctx.user;
}

export function useSetEmployeeUser(): (user: EmployeeUser) => void {
  const ctx = useContext(EmployeeUserContext);
  if (!ctx) {
    throw new Error("useSetEmployeeUser: используйте только внутри кабинета сотрудника после входа.");
  }
  return ctx.setUser;
}
