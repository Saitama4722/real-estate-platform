"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocationAutocomplete } from "@/components/crm/LocationAutocomplete";
import type { SellCity } from "@/lib/saleRequest";

const PHONE_EMPTY = "+7 ";
const PHONE_MIN_DIGITS = 10;
const MAX_PHOTOS = 10;
const DESC_MAX = 3000;

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

  const [locationRows, setLocationRows] = useState<LocationRow[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
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

  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 " +
    "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-2xl space-y-5">
      {/* Owner name */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          ФИО <span className="text-red-600">*</span>
        </label>
        <Input
          type="text"
          placeholder="Иван Иванов"
          value={ownerName}
          onChange={(e) => setOwnerName(stripName(e.target.value))}
          disabled={submitting}
          autoComplete="name"
        />
        {errors.owner_name && <p className="mt-1 text-xs text-red-600">{errors.owner_name}</p>}
      </div>

      {/* Phone */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Телефон <span className="text-red-600">*</span>
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
        {errors.owner_phone && <p className="mt-1 text-xs text-red-600">{errors.owner_phone}</p>}
      </div>

      {/* City */}
      <div>
        <LocationAutocomplete
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
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Описание объекта <span className="text-red-600">*</span>
        </label>
        <textarea
          placeholder="Расскажите о вашей недвижимости: тип, площадь, состояние, особенности…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={submitting}
          rows={5}
          maxLength={DESC_MAX}
          className={`${inputCls} resize-none`}
        />
        <p className="mt-1 text-right text-xs text-gray-400">
          {description.length}/{DESC_MAX}
        </p>
        {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
      </div>

      {/* Optional structured details */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium text-gray-600">
          Детали объекта (необязательно)
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Тип недвижимости</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              disabled={submitting}
              className={inputCls}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Площадь, м²</label>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Комнат</label>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Желаемая цена, ₽</label>
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
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Фотографии <span className="text-red-600">*</span>
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={submitting || photos.length >= MAX_PHOTOS}
          onChange={(e) => {
            onPickPhotos(e.target.files);
            e.target.value = "";
          }}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-gray-500">
          До {MAX_PHOTOS} фото. Первое станет главным при публикации.
        </p>
        {errors.photos && <p className="mt-1 text-xs text-red-600">{errors.photos}</p>}
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
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Проверка <span className="text-red-600">*</span>
        </label>
        {captchaLoading ? (
          <p className="text-sm text-gray-500">Загрузка примера…</p>
        ) : captchaQuestion ? (
          <>
            <p className="mb-2 text-sm text-gray-800">{captchaQuestion}</p>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Ответ (число)"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              disabled={submitting}
              autoComplete="off"
            />
          </>
        ) : (
          <p className="text-sm text-red-600">
            Проверка недоступна. Нажмите «Другой пример».
          </p>
        )}
        <div className="mt-2">
          <button
            type="button"
            className="text-xs text-blue-600 underline hover:text-blue-800 disabled:opacity-50"
            onClick={() => void loadCaptcha()}
            disabled={submitting || captchaLoading}
          >
            Другой пример
          </button>
        </div>
        {(errors.captcha || errors.captcha_answer || errors.captcha_id) && (
          <p className="mt-1 text-xs text-red-600">
            {errors.captcha_answer || errors.captcha || errors.captcha_id}
          </p>
        )}
      </div>

      {errors.general && <p className="text-sm text-red-600">{errors.general}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || captchaLoading}>
          {submitting ? "Отправка…" : "Отправить заявку"}
        </Button>
      </div>
    </form>
  );
}
