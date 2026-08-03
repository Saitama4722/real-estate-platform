"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  ImageUp,
  Lock,
  RotateCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LocationAutocomplete } from "@/components/crm/LocationAutocomplete";
import { cn } from "@/lib/utils";
import {
  ConsentCheckbox,
  CONSENT_REQUIRED_ERROR,
} from "@/components/legal/ConsentCheckbox";
import type { SellCity } from "@/lib/saleRequest";

const PHONE_EMPTY = "+7 ";
const PHONE_MIN_DIGITS = 10;
const MAX_PHOTOS = 10;
const DESC_MAX = 3000;

/** Card-header reassurance row. Static copy — no behaviour. */
const SELLING_POINTS = [
  { icon: Sparkles, text: "Бесплатная оценка объекта" },
  { icon: Clock, text: "Ответим за 1 рабочий день" },
  { icon: Lock, text: "Данные не публикуются" },
] as const;

/**
 * How many required answers the progress bar counts.
 *
 * ⚠ DISPLAY ONLY. This is a read-only mirror of what `validate()` already
 * requires — it never gates submission and `validate()` remains the single
 * source of truth. If a required field is ever added, update this number too,
 * or the bar will just read "N из 8" slightly wrong; nothing will break.
 */
const REQUIRED_STEPS = 8;

/** Russian plural for «поле» after a numeral (1 поле / 2 поля / 5 полей). */
function pluralFields(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "полей";
  switch (n % 10) {
    case 1:
      return "поле";
    case 2:
    case 3:
    case 4:
      return "поля";
    default:
      return "полей";
  }
}

/** Phone mask "+7 (XXX) XXX-XX-XX" — same behavior as the lead form. */
function formatPhoneMask(raw: string): string {
  let digits = (raw.match(/\d/g) ?? []).join("");
  if (digits.startsWith("7") || digits.startsWith("8")) digits = digits.slice(1);
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
function stripName(v: string): string {
  return v.replace(/[^a-zA-Zа-яА-ЯёЁ\s-]/g, "");
}
function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}
function countPhoneDigits(v: string): number {
  return (v.match(/\d/g) ?? []).length;
}

/** Kind-tagged option so district vs neighborhood is disambiguated (like the search combobox). */
interface LocationRow {
  key: string; // "d-<id>" | "n-<id>"
  id: number;
  kind: "district" | "neighborhood";
  name: string;
}

const PROPERTY_TYPES = [
  { value: "", label: "— не указывать —" },
  { value: "apartment", label: "Квартира" },
  { value: "house", label: "Дом" },
  { value: "land", label: "Участок" },
  { value: "commercial", label: "Коммерция" },
];

export function SellPropertyForm({ cities }: { cities: SellCity[] }) {
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState(PHONE_EMPTY);
  const [cityId, setCityId] = useState("");
  const [locationKey, setLocationKey] = useState(""); // key into locationRows
  const [description, setDescription] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [area, setArea] = useState("");
  const [rooms, setRooms] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  // Opens the sr-only file input from the styled picker button.
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Purely visual: whether a drag is currently hovering the photo drop zone.
  const [dragActive, setDragActive] = useState(false);
  const [locationRows, setLocationRows] = useState<LocationRow[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  // 152-ФЗ consent. MUST start false — an opt-out default is not valid consent.
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Arithmetic captcha — reuses the SAME endpoint as the buyer lead form
  // (/api/leads/captcha) and the same validation behavior.
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaQuestion, setCaptchaQuestion] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(true);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaAnswer("");
    setErrors((e) => {
      const n = { ...e };
      delete n.captcha;
      delete n.captcha_answer;
      delete n.captcha_id;
      return n;
    });
    try {
      const res = await fetch("/api/leads/captcha", { method: "GET" });
      if (!res.ok) {
        setCaptchaId(null);
        setCaptchaQuestion(null);
        return;
      }
      const data = (await res.json()) as { captcha_id?: string; question?: string };
      if (data.captcha_id && data.question) {
        setCaptchaId(data.captcha_id);
        setCaptchaQuestion(data.question);
      } else {
        setCaptchaId(null);
        setCaptchaQuestion(null);
      }
    } catch {
      setCaptchaId(null);
      setCaptchaQuestion(null);
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  // Fetch districts + neighborhoods for the chosen city, merged + kind-tagged.
  useEffect(() => {
    if (!cityId) {
      setLocationRows([]);
      setLocationKey("");
      return;
    }
    let cancelled = false;
    setLoadingLocations(true);
    setLocationKey("");
    (async () => {
      try {
        const [dRes, nRes] = await Promise.all([
          fetch(`/api/locations/districts/?city=${cityId}`),
          fetch(`/api/locations/neighborhoods/?city=${cityId}`),
        ]);
        const dData = dRes.ok ? await dRes.json() : [];
        const nData = nRes.ok ? await nRes.json() : [];
        const dList = Array.isArray(dData) ? dData : (dData.results ?? []);
        const nList = Array.isArray(nData) ? nData : (nData.results ?? []);
        if (cancelled) return;
        const rows: LocationRow[] = [
          ...nList.map((n: { id: number; name: string }) => ({
            key: `n-${n.id}`,
            id: n.id,
            kind: "neighborhood" as const,
            name: `${n.name} (микрорайон)`,
          })),
          ...dList.map((d: { id: number; name: string }) => ({
            key: `d-${d.id}`,
            id: d.id,
            kind: "district" as const,
            name: d.name,
          })),
        ];
        setLocationRows(rows);
      } catch (e) {
        console.error("[SellPropertyForm] locations fetch", e);
        if (!cancelled) setLocationRows([]);
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  // LocationAutocomplete works with {id, name}; we key options by a synthetic
  // numeric id (index) so district/neighborhood keys don't collide, and map back.
  const locationOptions = useMemo(
    () => locationRows.map((r, i) => ({ id: i, name: r.name })),
    [locationRows],
  );
  const selectedLocationOptId = useMemo(() => {
    const idx = locationRows.findIndex((r) => r.key === locationKey);
    return idx >= 0 ? String(idx) : "";
  }, [locationRows, locationKey]);

  const cityOptions = useMemo(
    () => cities.map((c) => ({ id: c.id, name: c.name })),
    [cities],
  );

  const onPickPhotos = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
    setErrors((e) => {
      const n = { ...e };
      delete n.photos;
      return n;
    });
  };
  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  /**
   * Drag-and-drop is only a second ENTRY POINT to onPickPhotos above — dropped
   * files go through exactly the same handler as the file dialog, which already
   * filters to image/* and caps at MAX_PHOTOS. No upload logic is duplicated or
   * changed here; only `dragActive` (a visual flag) is new.
   */
  const photosDisabled = submitting || photos.length >= MAX_PHOTOS;

  const onZoneDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    if (photosDisabled) return;
    // Required: without preventDefault the browser refuses the drop and instead
    // navigates away to open the file itself.
    e.preventDefault();
    if (!dragActive) setDragActive(true);
  };

  const onZoneDragLeave = () => setDragActive(false);

  const onZoneDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (photosDisabled) return;
    onPickPhotos(e.dataTransfer?.files ?? null);
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!ownerName.trim()) e.owner_name = "Укажите ваше ФИО.";
    if (!ownerPhone.trim() || countPhoneDigits(ownerPhone) < PHONE_MIN_DIGITS)
      e.owner_phone = "Укажите корректный номер телефона.";
    if (!cityId) e.city = "Выберите город.";
    if (!locationKey) e.location = "Выберите район или микрорайон.";
    if (description.trim().length < 10)
      e.description = "Опишите объект чуть подробнее (минимум 10 символов).";
    if (photos.length < 1) e.photos = "Добавьте хотя бы одно фото.";
    if (!captchaId) e.captcha = "Подождите загрузки проверки или обновите задачу.";
    if (!captchaAnswer.trim()) e.captcha_answer = "Введите ответ на пример.";
    // Belt-and-braces alongside the disabled submit button: the button covers
    // the pointer/Enter path, this covers any programmatic submit.
    if (!consent) e.consent = CONSENT_REQUIRED_ERROR;
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
    setSubmitting(true);
    try {
      const row = locationRows.find((r) => r.key === locationKey);
      const fd = new FormData();
      fd.append("owner_name", ownerName.trim());
      fd.append("owner_phone", ownerPhone.trim());
      fd.append("city", cityId);
      if (row?.kind === "district") fd.append("district", String(row.id));
      if (row?.kind === "neighborhood") fd.append("neighborhood", String(row.id));
      fd.append("description", description.trim());
      if (propertyType) fd.append("property_type", propertyType);
      if (area.trim()) fd.append("area", area.trim());
      if (rooms.trim()) fd.append("rooms", rooms.trim());
      if (askingPrice.trim()) fd.append("asking_price", digitsOnly(askingPrice));
      if (captchaId) fd.append("captcha_id", captchaId);
      fd.append("captcha_answer", captchaAnswer.trim());
      photos.forEach((f) => fd.append("photos", f));

      const res = await fetch("/api/sale-requests/", { method: "POST", body: fd });
      if (res.status === 429) {
        setErrors({ general: "Слишком много заявок. Пожалуйста, повторите позже." });
        return;
      }
      if (res.status === 201) {
        setSuccess(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const next: Record<string, string> = {};
      for (const [k, apiKey] of [
        ["owner_name", "owner_name"],
        ["owner_phone", "owner_phone"],
        ["city", "city"],
        ["description", "description"],
        ["photos", "photos"],
        ["captcha", "captcha"],
        ["captcha_answer", "captcha_answer"],
        ["captcha_id", "captcha_id"],
      ] as const) {
        const val = data[apiKey];
        if (Array.isArray(val) && val.length) next[k] = String(val[0]);
        else if (typeof val === "string") next[k] = val;
      }
      if (Object.keys(next).length === 0)
        next.general = "Не удалось отправить заявку. Попробуйте позже.";
      setErrors(next);
      // Reload a fresh captcha ONLY when it's expired/invalid — not on a plain
      // wrong answer (which keeps the question so the user can retry). Mirrors
      // the lesson documented for PublicLeadInquiryForm.
      if (next.captcha || next.captcha_id) {
        void loadCaptcha();
      }
    } catch (err) {
      console.error("[SellPropertyForm] submit", err);
      setErrors({ general: "Ошибка соединения. Попробуйте позже." });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-green-200 bg-green-50 px-6 py-10 text-center">
        <div className="text-2xl">✓</div>
        <h2 className="mt-3 text-lg font-semibold text-green-900">
          Спасибо, заявка принята!
        </h2>
        <p className="mt-2 text-sm text-green-800">
          Мы свяжемся с вами в ближайшее время, чтобы уточнить детали и помочь с
          продажей вашей недвижимости.
        </p>
      </div>
    );
  }

  // Field surface now comes from the shared .ctr-control class (globals.css,
  // FORM CONTROLS) so this form and the lead modal cannot drift apart.
  const inputCls = "ctr-control";

  // Derived, render-only: how many required answers are present. Nothing here
  // feeds submission — the disabled state below still comes from the same
  // `consent` / captcha conditions it always did.
  const filledCount = [
    ownerName.trim().length > 1,
    countPhoneDigits(ownerPhone) >= PHONE_MIN_DIGITS,
    !!cityId,
    !!locationKey,
    description.trim().length >= 10,
    photos.length > 0,
    captchaAnswer.trim() !== "",
    consent,
  ].filter(Boolean).length;
  const remaining = REQUIRED_STEPS - filledCount;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Card header strip: progress + what the seller gets. Full-bleed inside
          the card, so the form owns its own padding below rather than the page. */}
      <div className="bg-brand-tint px-5 pt-[18px] pb-4">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold text-brand">
            Заполнено {filledCount} из {REQUIRED_STEPS}
          </span>
          <span className="text-[13px] text-fg-muted">≈ 3 минуты</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-blue-200"
          role="progressbar"
          aria-valuenow={filledCount}
          aria-valuemin={0}
          aria-valuemax={REQUIRED_STEPS}
          aria-label="Заполнено полей"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
            style={{ width: `${(filledCount / REQUIRED_STEPS) * 100}%` }}
          />
        </div>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {SELLING_POINTS.map(({ icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-2.5 text-[13px] leading-tight text-fg-secondary"
            >
              <Icon icon={icon} className="size-[17px] shrink-0 text-brand" />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-[22px] px-5 pt-7 pb-6 sm:px-6">
      {/* Owner name */}
      <div>
        <label className="ctr-label mb-[7px]">
          ФИО <span className="ctr-label__req">*</span>
        </label>
        <Input
          type="text"
          placeholder="Иван Иванов"
          value={ownerName}
          onChange={(e) => setOwnerName(stripName(e.target.value))}
          disabled={submitting}
          autoComplete="name"
        />
        {errors.owner_name && <p className="mt-1 text-xs text-danger">{errors.owner_name}</p>}
      </div>

      {/* Phone */}
      <div>
        <label className="ctr-label mb-[7px]">
          Телефон <span className="ctr-label__req">*</span>
        </label>
        <Input
          type="tel"
          placeholder="+7 (___) ___-__-__"
          value={ownerPhone}
          onChange={(e) => setOwnerPhone(formatPhoneMask(e.target.value))}
          disabled={submitting}
          autoComplete="tel"
        />
        <p className="mt-1 text-xs text-gray-500">
          Ваш номер видят только сотрудники агентства. На сайте он не публикуется.
        </p>
        {errors.owner_phone && <p className="mt-1 text-xs text-danger">{errors.owner_phone}</p>}
      </div>

      {/* City */}
      <div>
        <LocationAutocomplete
          publicStyle
          label="Город"
          required
          placeholder="— выберите город —"
          value={cityId}
          options={cityOptions}
          disabled={submitting}
          error={errors.city}
          onChange={(id) => {
            setCityId(id);
            setErrors((e) => {
              const n = { ...e };
              delete n.city;
              return n;
            });
          }}
        />
      </div>

      {/* District / neighborhood — same combobox pattern, scoped to city */}
      <div>
        <LocationAutocomplete
          publicStyle
          label="Район / микрорайон"
          required
          placeholder={
            !cityId
              ? "— сначала выберите город —"
              : loadingLocations
                ? "Загрузка…"
                : "— начните вводить —"
          }
          value={selectedLocationOptId}
          options={locationOptions}
          disabled={submitting || !cityId || loadingLocations}
          error={errors.location}
          onChange={(optId) => {
            const idx = optId === "" ? -1 : parseInt(optId, 10);
            setLocationKey(idx >= 0 ? (locationRows[idx]?.key ?? "") : "");
            setErrors((e) => {
              const n = { ...e };
              delete n.location;
              return n;
            });
          }}
        />
      </div>

      {/* Description */}
      <div>
        <label className="ctr-label mb-[7px]">
          Описание объекта <span className="ctr-label__req">*</span>
        </label>
        {/* relative: the counter is parked in the textarea's bottom gutter. */}
        <div className="relative">
          <textarea
            placeholder="Расскажите о вашей недвижимости: тип, площадь, состояние, особенности…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            rows={5}
            maxLength={DESC_MAX}
            aria-invalid={errors.description ? true : undefined}
            className="ctr-control ctr-control--area block"
          />
          <div className="ctr-counter">
            {description.length}/{DESC_MAX}
          </div>
        </div>
        {errors.description && <p className="mt-1 text-xs text-danger">{errors.description}</p>}
      </div>

      {/* Optional structured details */}
      <fieldset className="ctr-well ctr-well--lg">
        <legend className="mb-4 flex items-center gap-2.5 p-0">
          <span className="text-sm font-bold tracking-tight text-fg">
            Детали объекта
          </span>
          <span className="rounded-full bg-surface-inset px-2.5 py-1 text-[11.5px] font-semibold text-fg-muted">
            необязательно
          </span>
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="ctr-label mb-[7px]">Тип недвижимости</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              disabled={submitting}
              className={`${inputCls} ctr-control--select`}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ctr-label mb-[7px]">Площадь, м²</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="например, 54"
              value={area}
              onChange={(e) => setArea(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="ctr-label mb-[7px]">Комнат</label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="например, 2"
              value={rooms}
              onChange={(e) => setRooms(digitsOnly(e.target.value).slice(0, 2))}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="ctr-label mb-[7px]">Желаемая цена, ₽</label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="например, 6 500 000"
              value={askingPrice}
              onChange={(e) => setAskingPrice(digitsOnly(e.target.value))}
              disabled={submitting}
            />
          </div>
        </div>
      </fieldset>

      {/* Photos */}
      <div>
        <label className="ctr-label mb-[7px]">
          Фотографии <span className="ctr-label__req">*</span>
        </label>
        {/* Styled picker: the native control is kept in the DOM (sr-only, NOT
            display:none, so it stays reachable by assistive tech and keyboard)
            and a styled button opens it — the same idiom CrmStagedPhotosPicker
            already uses. The onChange handler below is byte-identical to the
            one the bare input had, so photo handling is unchanged. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={submitting || photos.length >= MAX_PHOTOS}
          onChange={(e) => {
            onPickPhotos(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={onZoneDragOver}
          onDragOver={onZoneDragOver}
          onDragLeave={onZoneDragLeave}
          onDrop={onZoneDrop}
          disabled={photosDisabled}
          className={cn(
            "flex w-full items-center gap-3.5 rounded-[14px] p-[18px] text-left",
            // Colour + shadow only, so this stays correct under reduced motion —
            // that policy cancels movement, not colour/shadow changes.
            "transition-[background-color,box-shadow] duration-200 ease-out",
            "disabled:cursor-not-allowed disabled:opacity-60",
            dragActive
              ? "bg-brand-tint shadow-[inset_0_0_0_2px_var(--color-brand)]"
              : // ⚠ bg-[var(--field-bg)], NOT bg-[--field-bg]. The bare form is
                // Tailwind v3 shorthand; v4 still emits a rule for it but as
                // `background-color: --field-bg`, which is invalid CSS and the
                // browser drops it — the zone rendered fully transparent.
                // Verified in the compiled stylesheet, not by eye.
                "bg-[var(--field-bg)] shadow-[inset_0_0_0_1.5px_rgba(22,24,29,.14)] hover:bg-brand-tint hover:shadow-[inset_0_0_0_1.5px_var(--color-brand)] disabled:hover:bg-[var(--field-bg)] disabled:hover:shadow-[inset_0_0_0_1.5px_rgba(22,24,29,.14)]",
          )}
        >
          {/* pointer-events-none on BOTH children: without it, dragging across a
              child fires dragleave on the button and the highlight flickers.
              They are decorative, so nothing is lost by making them inert. */}
          <span className="pointer-events-none flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint">
            <Icon icon={ImageUp} className="size-[21px] text-brand" />
          </span>
          <span className="pointer-events-none min-w-0">
            <span className="block text-[14.5px] font-semibold text-fg">
              {photos.length >= MAX_PHOTOS
                ? "Достигнут лимит фотографий"
                : dragActive
                  ? "Отпустите, чтобы добавить"
                  : "Перетащите фото сюда"}
            </span>
            <span className="mt-0.5 block text-[13px] text-fg-muted">
              {photos.length >= MAX_PHOTOS ? (
                "Удалите лишние, чтобы добавить другие"
              ) : (
                <>
                  или <span className="font-semibold text-brand">выберите файлы</span>{" "}
                  на устройстве
                </>
              )}
            </span>
          </span>
        </button>
        <p className="mt-2 text-xs text-fg-muted">
          До {MAX_PHOTOS} фото. Первое станет главным при публикации.
        </p>
        {errors.photos && <p className="mt-1 text-xs text-danger">{errors.photos}</p>}
        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((f, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-md border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white hover:bg-black/80"
                  aria-label="Удалить фото"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Captcha (same arithmetic check as the buyer lead form) */}
      <div className="ctr-well ctr-well--lg">
        <div className="flex items-center gap-2.5">
          <Icon icon={ShieldCheck} className="size-[17px] text-brand" />
          <span className="flex items-center gap-1 text-sm font-bold tracking-tight text-fg">
            Проверка<span className="ctr-label__req">*</span>
          </span>
        </div>
        {captchaLoading ? (
          <p className="text-[15px] text-fg-muted">Загрузка примера…</p>
        ) : captchaQuestion ? (
          <>
            <p className="text-[15px] text-fg-secondary">{captchaQuestion}</p>
            {/* Answer and "another example" sit on one row — the answer is a few
                characters, so a full-width field over-weights it. */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Width lives on the WRAPPER: .ctr-control sets width:100% and is
                  unlayered, so a w-* utility on the input itself would lose. */}
              <div className="w-[140px]">
                <Input
                  className="ctr-control"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ответ"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  disabled={submitting}
                  autoComplete="off"
                  aria-invalid={
                    errors.captcha_answer || errors.captcha || errors.captcha_id
                      ? true
                      : undefined
                  }
                />
              </div>
              <button
                type="button"
                className="ctr-textbtn"
                onClick={() => void loadCaptcha()}
                disabled={submitting || captchaLoading}
              >
                <Icon icon={RotateCw} className="size-4" />
                Другой пример
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[15px] text-danger">
              Проверка недоступна. Нажмите «Другой пример».
            </p>
            <button
              type="button"
              className="ctr-textbtn"
              onClick={() => void loadCaptcha()}
              disabled={submitting || captchaLoading}
            >
              <Icon icon={RotateCw} className="size-4" />
              Другой пример
            </button>
          </>
        )}
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
          if (next) {
            setErrors((e) => {
              const rest = { ...e };
              delete rest.consent;
              return rest;
            });
          }
        }}
        disabled={submitting}
        error={errors.consent}
      />

      {/* Submit stays disabled until consent is given (152-ФЗ). Geometry comes
          from size="lg" - never className, see button-classes.ts. */}
      <div className="flex flex-col gap-2.5">
        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={submitting || captchaLoading || !consent}
        >
          {submitting ? "Отправка…" : "Отправить заявку"}
        </Button>
        {remaining > 0 && (
          <p className="text-center text-xs text-fg-muted">
            Осталось заполнить {remaining} {pluralFields(remaining)}
          </p>
        )}
      </div>
      </div>
    </form>
  );
}
