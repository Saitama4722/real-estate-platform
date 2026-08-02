"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCw, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  ConsentCheckbox,
  CONSENT_REQUIRED_ERROR,
} from "@/components/legal/ConsentCheckbox";

const PHONE_MIN_DIGITS = 10;
const MESSAGE_MAX_LENGTH = 300;

function countPhoneDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/** Пустое значение телефона — всегда начинается с префикса «+7 ». */
const PHONE_EMPTY = "+7 ";

/**
 * Маска телефона «+7 (XXX) XXX-XX-XX». Берёт только цифры, отбрасывает ведущую
 * 7/8 (код страны), ограничивает до 10 цифр номера и прогрессивно форматирует —
 * частичный ввод показывается корректно (напр. «+7 (958) 2»). Префикс «+7»
 * несъедобен: пустой/короткий ввод сворачивается обратно к «+7 ».
 */
function formatPhoneMask(raw: string): string {
  let digits = (raw.match(/\d/g) ?? []).join("");
  // Убираем код страны (7 или 8), дальше работаем с 10 цифрами номера.
  if (digits.startsWith("7") || digits.startsWith("8")) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  if (digits.length === 0) return PHONE_EMPTY;

  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 8);
  const d = digits.slice(8, 10);

  let out = `+7 (${a}`;
  if (digits.length >= 3) out += ")";
  if (b) out += ` ${b}`;
  if (c) out += `-${c}`;
  if (d) out += `-${d}`;
  return out;
}

/** Имя: только буквы (кириллица/латиница) и пробелы; остальное вырезается. */
function stripName(value: string): string {
  return value.replace(/[^a-zA-Zа-яА-ЯёЁ\s]/g, "");
}

function firstError(
  data: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = data[key];
  if (v == null) return undefined;
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  if (typeof v === "string") return v;
  return undefined;
}

export interface PublicLeadInquiryFormProps {
  /** Если задано, лид привязывается к опубликованному объекту. */
  propertyId?: number;
  /**
   * Публичный CRM ID риэлтора (RID######). Если задан и объект не указан, лид
   * привязывается к этому риэлтору (заявка со страницы профиля риэлтора).
   */
  realtorCrmId?: string;
}

export function PublicLeadInquiryForm({
  propertyId,
  realtorCrmId,
}: PublicLeadInquiryFormProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState(PHONE_EMPTY);
  const [clientMessage, setClientMessage] = useState("");
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaQuestion, setCaptchaQuestion] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  // 152-ФЗ consent. MUST start false — an opt-out default is not valid consent.
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaAnswer("");
    setErrors((e) => {
      const next = { ...e };
      delete next.captcha;
      delete next.captcha_answer;
      delete next.captcha_id;
      delete next.general;
      return next;
    });
    try {
      const res = await fetch("/api/leads/captcha", { method: "GET" });
      if (!res.ok) {
        setCaptchaId(null);
        setCaptchaQuestion(null);
        setErrors((e) => ({
          ...e,
          general: "Не удалось загрузить проверку. Обновите страницу.",
        }));
        return;
      }
      const data = (await res.json()) as {
        captcha_id?: string;
        question?: string;
      };
      if (data.captcha_id && data.question) {
        setCaptchaId(data.captcha_id);
        setCaptchaQuestion(data.question);
      } else {
        setCaptchaId(null);
        setCaptchaQuestion(null);
        setErrors((e) => ({
          ...e,
          general: "Не удалось загрузить проверку. Обновите страницу.",
        }));
      }
    } catch {
      setCaptchaId(null);
      setCaptchaQuestion(null);
      setErrors((e) => ({
        ...e,
        general: "Ошибка соединения при загрузке проверки.",
      }));
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!clientName.trim()) {
      e.client_name = "Укажите ваше имя.";
    }
    if (!clientPhone.trim()) {
      e.client_phone = "Укажите номер телефона.";
    } else if (countPhoneDigits(clientPhone) < PHONE_MIN_DIGITS) {
      e.client_phone = "Укажите корректный номер телефона.";
    }
    if (!clientMessage.trim()) {
      e.client_message = "Введите ваш вопрос или комментарий.";
    } else if (clientMessage.trim().length > MESSAGE_MAX_LENGTH) {
      e.client_message = "Сообщение слишком длинное. Максимум 300 символов.";
    }
    if (!captchaId) {
      e.captcha = "Подождите загрузки проверки или обновите задачу.";
    }
    if (!String(captchaAnswer).trim()) {
      e.captcha_answer = "Введите ответ на пример.";
    }
    // Belt-and-braces alongside the disabled submit button: the button covers
    // the pointer/Enter path, this covers any programmatic submit.
    if (!consent) {
      e.consent = CONSENT_REQUIRED_ERROR;
    }
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        client_message: clientMessage.trim(),
        captcha_id: captchaId,
        captcha_answer: String(captchaAnswer).trim(),
      };
      if (propertyId != null) {
        body.property = propertyId;
      } else if (realtorCrmId) {
        // Заявка со страницы риэлтора (без объекта) — привязываем к риэлтору.
        body.assigned_realtor_crm_id = realtorCrmId;
      }
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 429) {
        setErrors({
          general: "Слишком много заявок. Пожалуйста, повторите позже.",
        });
        return;
      }
      if (res.ok) {
        setSuccess(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const next: Record<string, string> = {};
      const cn = firstError(data, "client_name");
      const cp = firstError(data, "client_phone");
      const cm = firstError(data, "client_message");
      const pm = firstError(data, "property");
      const rm = firstError(data, "assigned_realtor_crm_id");
      const ca = firstError(data, "captcha_answer");
      const cid = firstError(data, "captcha_id");
      const cap = firstError(data, "captcha");
      if (cn) next.client_name = cn;
      if (cp) next.client_phone = cp;
      if (cm) next.client_message = cm;
      if (pm) next.general = pm;
      if (rm) next.general = rm;
      if (ca) next.captcha_answer = ca;
      if (cid) next.captcha_id = cid;
      if (cap) next.captcha = cap;
      if (Object.keys(next).length === 0) {
        next.general = "Не удалось отправить заявку. Попробуйте позже.";
      }
      setErrors(next);
      // Reload a fresh example ONLY when the captcha itself is gone (expired or
      // invalid id) — not on a plain wrong answer. Reloading on a wrong answer
      // would clear captchaAnswer and wipe the just-set "Неверный ответ" error
      // (loadCaptcha resets both), so the user would see the question silently
      // change with no explanation. On a wrong answer we keep the same question
      // and the entered value, and leave the inline error visible so the user
      // can correct it (or press «Другой пример» themselves).
      if (cap || cid) {
        void loadCaptcha();
      }
    } catch (err) {
      console.error("[PublicLeadInquiryForm] submit", err);
      setErrors({ general: "Ошибка соединения. Попробуйте позже." });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
        Заявка отправлена! Мы свяжемся с вами в ближайшее время.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-[18px]">
      <div className="ctr-field">
        <label className="ctr-label" htmlFor="lead-name">
          Ваше имя<span className="ctr-label__req">*</span>
        </label>
        <Input
          id="lead-name"
          className="ctr-control"
          type="text"
          placeholder="Иван Иванов"
          value={clientName}
          onChange={(e) => setClientName(stripName(e.target.value))}
          disabled={loading}
          autoComplete="name"
          aria-invalid={errors.client_name ? true : undefined}
        />
        {errors.client_name && (
          <p className="text-xs text-danger">{errors.client_name}</p>
        )}
      </div>

      <div className="ctr-field">
        <label className="ctr-label" htmlFor="lead-phone">
          Телефон<span className="ctr-label__req">*</span>
        </label>
        <Input
          id="lead-phone"
          className="ctr-control"
          type="tel"
          placeholder="+7 (___) ___-__-__"
          value={clientPhone}
          onChange={(e) => setClientPhone(formatPhoneMask(e.target.value))}
          disabled={loading}
          autoComplete="tel"
          aria-invalid={errors.client_phone ? true : undefined}
        />
        {errors.client_phone && (
          <p className="text-xs text-danger">{errors.client_phone}</p>
        )}
      </div>

      <div className="ctr-field">
        <label className="ctr-label" htmlFor="lead-message">
          Сообщение<span className="ctr-label__req">*</span>
        </label>
        {/* relative: the counter is parked in the textarea's bottom gutter. */}
        <div className="relative">
          <textarea
            id="lead-message"
            placeholder="Ваш вопрос или комментарий"
            value={clientMessage}
            onChange={(e) => setClientMessage(e.target.value)}
            disabled={loading}
            rows={4}
            maxLength={MESSAGE_MAX_LENGTH}
            aria-invalid={errors.client_message ? true : undefined}
            className="ctr-control ctr-control--area block"
          />
          <div className="ctr-counter">
            {clientMessage.length}/{MESSAGE_MAX_LENGTH}
          </div>
        </div>
        {errors.client_message && (
          <p className="text-xs text-danger">{errors.client_message}</p>
        )}
      </div>

      <div className="ctr-well">
        <div className="flex items-center gap-2">
          <Icon icon={ShieldCheck} className="size-[15px] text-brand" />
          <span className="ctr-label">
            Проверка<span className="ctr-label__req">*</span>
          </span>
        </div>
        {captchaLoading ? (
          <p className="text-[15px] text-fg-muted">Загрузка примера…</p>
        ) : captchaQuestion ? (
          <>
            <p className="text-[15px] text-fg">{captchaQuestion}</p>
            <Input
              className="ctr-control"
              type="text"
              inputMode="numeric"
              placeholder="Ответ (число)"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              disabled={loading}
              autoComplete="off"
              aria-invalid={
                errors.captcha_answer || errors.captcha || errors.captcha_id
                  ? true
                  : undefined
              }
            />
          </>
        ) : (
          <p className="text-[15px] text-danger">
            Проверка недоступна. Нажмите «Другой пример».
          </p>
        )}
        <button
          type="button"
          className="ctr-textbtn"
          onClick={() => void loadCaptcha()}
          disabled={loading || captchaLoading}
        >
          <Icon icon={RotateCw} className="size-[13px]" />
          Другой пример
        </button>
        {(errors.captcha || errors.captcha_answer || errors.captcha_id) && (
          <p className="text-xs text-danger">
            {errors.captcha_answer || errors.captcha || errors.captcha_id}
          </p>
        )}
      </div>

      {errors.general && <p className="text-sm text-danger">{errors.general}</p>}

      <ConsentCheckbox
        checked={consent}
        onCheckedChange={(next) => {
          setConsent(next);
          // Clear the consent error as soon as it stops being true, so the
          // message does not linger next to a now-ticked box.
          if (next) {
            setErrors((e) => {
              const rest = { ...e };
              delete rest.consent;
              return rest;
            });
          }
        }}
        disabled={loading}
        error={errors.consent}
      />

      {/* Submit stays disabled until consent is given (152-ФЗ). Geometry comes
          from size="lg" (the design's 48px control height) - never className,
          see the conflict-resolution note in button-classes.ts. */}
      <Button
        type="submit"
        size="lg"
        fullWidth
        disabled={loading || captchaLoading || !consent}
      >
        {loading ? "Отправка..." : "Отправить"}
      </Button>
    </form>
  );
}
