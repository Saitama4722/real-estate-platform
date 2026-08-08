"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, Icons } from "@/components/ui/icon";
import { setCrmTokens } from "@/lib/crmAuth";
import { employeeAuthAbsoluteUrl } from "@/lib/crmAuthConstants";
import {
  AUTH_BANNERS,
  bannerForStatus,
  formatCountdown,
  parseRetryAfter,
  throttleBanner,
  validateEmail,
  validatePassword,
  type AuthBanner,
} from "@/components/auth/authErrors";
import { cn } from "@/lib/utils";

/**
 * Employee sign-in.
 *
 * ⚠ THE AUTH CONTRACT IS UNCHANGED. Same endpoint, same `{email, password}`
 * body, same token handling via setCrmTokens, same `/account` redirect. This
 * component is presentation plus client behaviour only — if you find yourself
 * editing the fetch or the redirect, stop.
 *
 * ⚠ NOTHING HERE MAY LOG OR PERSIST A CREDENTIAL. The password lives in React
 * state for the lifetime of the form and goes nowhere else: not to console (the
 * catch logs the error object only), not to a URL, not to storage.
 */

type Touched = { email: boolean; password: boolean };

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [touched, setTouched] = useState<Touched>({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [banner, setBanner] = useState<AuthBanner | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bannerRef = useRef<HTMLDivElement | null>(null);
  /* Guards a second submit that beats the `submitting` re-render (double
     Enter, or Enter plus a click). `disabled` alone is a frame too slow. */
  const inFlightRef = useRef(false);

  /* Validate only once a field has been left or the form submitted — never
     while someone is still typing an address for the first time. */
  const emailError = touched.email || submitted ? validateEmail(email) : null;
  const passwordError = touched.password || submitted ? validatePassword(password) : null;

  // Throttle countdown. Ticks down to 0, then leaves the banner in place with
  // its generic copy rather than implying the block has certainly lifted.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      return;
    }
    const id = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [countdown]);

  // The banner is the most important thing on the page when it appears, so it
  // takes focus; role="alert" also announces it.
  useEffect(() => {
    if (banner) bannerRef.current?.focus();
  }, [banner]);

  const probeCaps = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Real modifier state from the real event — never inferred from the text.
    const on = e.getModifierState?.("CapsLock") ?? false;
    setCapsOn((prev) => (prev === on ? prev : on));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current) return;

    setSubmitted(true);
    const emailIssue = validateEmail(email);
    const passwordIssue = validatePassword(password);
    if (emailIssue || passwordIssue) {
      setBanner(null);
      return;
    }

    inFlightRef.current = true;
    setBanner(null);
    setCountdown(null);
    setSubmitting(true);
    try {
      const res = await fetch(employeeAuthAbsoluteUrl("login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
        setBanner(bannerForStatus(res.status, retryAfter));
        if (res.status === 429 && retryAfter) setCountdown(retryAfter);
        return;
      }

      const data = await res.json().catch(() => null);
      if (
        !data ||
        typeof data.access !== "string" ||
        typeof data.refresh !== "string"
      ) {
        setBanner(AUTH_BANNERS.badPayload);
        return;
      }

      setCrmTokens(data.access, data.refresh);
      router.push("/account");
      router.refresh();
      // Deliberately stay in the submitting state: the redirect is in flight and
      // re-enabling the form would invite a second submit.
      return;
    } catch {
      // No error object logged — it can carry the request body on some engines.
      setBanner(AUTH_BANNERS.network);
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const bannerBody =
    banner?.retryAfterSec && countdown !== null
      ? `${banner.body} ${formatCountdown(countdown)}.`
      : banner?.body;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      <h1 className="m-0 text-[clamp(25px,3vw,32px)] leading-[1.15] font-bold tracking-[-0.025em] text-fg">
        Вход в личный кабинет
      </h1>
      {/* fg-secondary, not fg-muted: muted (#6a7180) on the warm surface
          measures 4.49:1 — a hair under AA, as CLAUDE.md records for the same
          pair in breadcrumbs. The placeholder may stay muted; it sits on the
          field's white fill, where it clears. */}
      <p className="mt-2 mb-8 text-[15px] leading-[1.5] text-fg-secondary">
        Email и пароль учётной записи сотрудника
      </p>

      {banner && (
        <div
          ref={bannerRef}
          role="alert"
          tabIndex={-1}
          className={cn(
            "mb-6 flex gap-3 rounded-[10px] border p-4 focus:outline-none",
            banner.tone === "warning"
              ? "border-amber-200 bg-amber-50"
              : "border-red-200 bg-red-50",
          )}
        >
          <Icon
            icon={banner.tone === "warning" ? Icons.Clock : Icons.Alert}
            size={20}
            className={cn(
              "mt-px shrink-0",
              banner.tone === "warning" ? "text-warning" : "text-danger",
            )}
          />
          <div>
            <div
              className={cn(
                "text-small font-semibold leading-[1.35]",
                banner.tone === "warning" ? "text-amber-800" : "text-red-800",
              )}
            >
              {banner.title}
            </div>
            <div
              className={cn(
                "mt-[3px] text-[13px] leading-[1.45]",
                banner.tone === "warning" ? "text-amber-900" : "text-red-900",
              )}
            >
              {bannerBody}
            </div>
          </div>
        </div>
      )}

      <label htmlFor="auth-email" className="ctr-auth-label mb-2">
        Email
      </label>
      <input
        id="auth-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="ivanov@centreal.ru"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        disabled={submitting}
        aria-invalid={emailError ? true : undefined}
        aria-describedby={emailError ? "auth-email-error" : undefined}
        className="ctr-auth-control"
      />
      {emailError && (
        <FieldError id="auth-email-error">{emailError}</FieldError>
      )}

      <div className="mt-[22px] mb-2 flex items-baseline justify-between gap-4">
        <label htmlFor="auth-password" className="ctr-auth-label">
          Пароль
        </label>
        {/* The mockup puts «Забыли пароль?» here. Omitted until a recovery route
            exists — a prominent link to a 404 is worse than its absence. */}
      </div>
      <div className="relative">
        <input
          id="auth-password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          onKeyUp={probeCaps}
          onKeyDown={probeCaps}
          disabled={submitting}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={
            [passwordError ? "auth-password-error" : null, capsOn ? "auth-caps" : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className="ctr-auth-control ctr-auth-control--password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-pressed={showPassword}
          aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
          aria-controls="auth-password"
          disabled={submitting}
          className="ctr-auth-toggle"
        >
          <Icon icon={showPassword ? Icons.EyeOff : Icons.Eye} size={20} />
        </button>
      </div>
      {passwordError && (
        <FieldError id="auth-password-error">{passwordError}</FieldError>
      )}
      {capsOn && (
        <p
          id="auth-caps"
          className="mt-2.5 flex items-center gap-2 text-[13px] leading-[1.4] font-medium text-warning"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M9 18v-6H5l7-7 7 7h-4v6H9z" />
          </svg>
          Включён Caps Lock
        </p>
      )}

      <div aria-hidden="true" className="h-8" />

      <button type="submit" disabled={submitting} className="ctr-auth-submit">
        {submitting ? (
          <span className="flex items-center justify-center gap-2.5">
            {/* Reduced motion cancels the spin, so the LABEL carries the state. */}
            <Icon icon={Icons.Loader} size={20} className="h-[18px] w-[18px] animate-spin" />
            Входим…
          </span>
        ) : (
          "Войти"
        )}
      </button>

      <Link
        href="/"
        className="mt-5 inline-flex h-11 items-center gap-1.5 self-center px-3 text-small font-medium text-brand no-underline transition-colors duration-[150ms] hover:text-brand-hover focus-ring-brand"
      >
        <Icon icon={Icons.ArrowLeft} size={16} />
        На главную
      </Link>
    </form>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      className="mt-[9px] flex items-center gap-[7px] text-[13px] leading-[1.4] font-medium text-danger"
    >
      <Icon icon={Icons.Alert} size={16} className="h-[15px] w-[15px] shrink-0" />
      {children}
    </p>
  );
}
