"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setCrmTokens } from "@/lib/crmAuth";
import { employeeAuthAbsoluteUrl } from "@/lib/crmAuthConstants";

function formatLoginErrorMessage(data: Record<string, unknown>): string {
  const fallback = "Неверный email или пароль, либо учётная запись неактивна.";

  const detail = data.detail;
  if (typeof detail === "string") {
    const d = detail.trim();
    if (
      d === "No active account found with the given credentials." ||
      d === "No active account found with the given credentials"
    ) {
      return fallback;
    }
    return d || fallback;
  }
  if (Array.isArray(detail)) {
    const parts = detail.map((x: unknown) => (typeof x === "string" ? x : JSON.stringify(x)));
    if (parts.length) return parts.join(" ");
  }

  const nfe = data.non_field_errors;
  if (Array.isArray(nfe) && nfe.length && typeof nfe[0] === "string") {
    return nfe.join(" ");
  }

  const emailErr = data.email;
  if (Array.isArray(emailErr) && emailErr.length && typeof emailErr[0] === "string") {
    return emailErr.join(" ");
  }

  return fallback;
}

export function CrmLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(employeeAuthAbsoluteUrl("login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch((parseErr) => {
        console.error("[CrmLoginForm] JSON", parseErr);
        return {};
      });
      if (!res.ok) {
        setError(formatLoginErrorMessage(data as Record<string, unknown>));
        return;
      }
      if (typeof data.access !== "string" || typeof data.refresh !== "string") {
        console.error("[CrmLoginForm] unexpected payload", data);
        setError("Некорректный ответ сервера.");
        return;
      }
      setCrmTokens(data.access, data.refresh);
      router.push("/account");
      router.refresh();
    } catch (err) {
      console.error("[CrmLoginForm]", err);
      setError("Ошибка соединения. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-md space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Пароль</label>
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Вход…" : "Войти"}
      </Button>
      <p className="text-center text-sm text-gray-500">
        <Link href="/" className="text-blue-600 hover:underline">
          На главную
        </Link>
      </p>
    </form>
  );
}
