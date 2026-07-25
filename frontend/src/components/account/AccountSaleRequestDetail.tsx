"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchWithCrmAuthRetry, getCrmAccessToken } from "@/lib/crmAuth";
import { isCabinetAdminRole } from "@/lib/employeeUser";
import { useEmployeeUser } from "@/components/account/EmployeeAuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LocationShort {
  id: number;
  name: string;
  slug: string;
}
interface PhotoRow {
  id: number;
  image: string;
  sort_order: number;
}
interface SaleRequestDetail {
  id: number;
  owner_name: string;
  owner_phone: string;
  city: LocationShort | null;
  district: LocationShort | null;
  neighborhood: LocationShort | null;
  description: string;
  property_type: string;
  property_type_label: string;
  area: string | null;
  rooms: number | null;
  asking_price: string | null;
  status: string;
  status_label: string;
  converted_property: number | null;
  converted_property_pid: string | null;
  converted_at: string | null;
  photos: PhotoRow[];
  created_at: string;
}

const EDITABLE_STATUSES = [
  { value: "new", label: "Новая" },
  { value: "in_progress", label: "В работе" },
  { value: "rejected", label: "Отклонена" },
];
const TYPE_OPTIONS = [
  { value: "", label: "— не указан —" },
  { value: "apartment", label: "Квартира" },
  { value: "house", label: "Дом" },
  { value: "land", label: "Участок" },
  { value: "commercial", label: "Коммерция" },
];

export function AccountSaleRequestDetail({ id }: { id: string }) {
  const router = useRouter();
  const user = useEmployeeUser();
  const isAdmin = isCabinetAdminRole(user.role);

  const [data, setData] = useState<SaleRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  // Edit state
  const [ownerName, setOwnerName] = useState("");
  const [description, setDescription] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [area, setArea] = useState("");
  const [rooms, setRooms] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [status, setStatus] = useState("new");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [deleting, setDeleting] = useState(false);

  const seedEditFields = useCallback((d: SaleRequestDetail) => {
    setOwnerName(d.owner_name ?? "");
    setDescription(d.description ?? "");
    setPropertyType(d.property_type ?? "");
    setArea(d.area != null ? String(d.area).replace(/\.00$/, "") : "");
    setRooms(d.rooms != null ? String(d.rooms) : "");
    setAskingPrice(d.asking_price != null ? String(d.asking_price).split(".")[0] : "");
    setStatus(d.status ?? "new");
  }, []);

  const load = useCallback(async () => {
    if (!getCrmAccessToken()) {
      setError("Требуется вход.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithCrmAuthRetry(
        `/api/crm/sale-requests/${encodeURIComponent(id)}/`,
      );
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setError("Не удалось загрузить заявку.");
        return;
      }
      const d = (await res.json()) as SaleRequestDetail;
      setData(d);
      seedEditFields(d);
    } catch (e) {
      console.error("[AccountSaleRequestDetail] load", e);
      setError("Ошибка соединения.");
    } finally {
      setLoading(false);
    }
  }, [id, seedEditFields]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const body: Record<string, unknown> = {
        owner_name: ownerName.trim(),
        description: description.trim(),
        property_type: propertyType,
        status,
      };
      body.area = area.trim() ? area.trim() : null;
      body.rooms = rooms.trim() ? parseInt(rooms.trim(), 10) : null;
      body.asking_price = askingPrice.trim() ? askingPrice.replace(/\D/g, "") : null;
      const res = await fetchWithCrmAuthRetry(
        `/api/crm/sale-requests/${encodeURIComponent(id)}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        setSaveMsg("Не удалось сохранить.");
        return;
      }
      const d = (await res.json()) as SaleRequestDetail;
      setData(d);
      seedEditFields(d);
      setSaveMsg("Сохранено.");
    } catch (e) {
      console.error("[AccountSaleRequestDetail] save", e);
      setSaveMsg("Ошибка соединения.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Удалить заявку на продажу безвозвратно?")) return;
    setDeleting(true);
    try {
      const res = await fetchWithCrmAuthRetry(
        `/api/crm/sale-requests/${encodeURIComponent(id)}/`,
        { method: "DELETE" },
      );
      if (res.status === 204) {
        router.push("/account/sale-requests");
        router.refresh();
        return;
      }
      if (res.status === 403) {
        window.alert("Удаление доступно только администратору.");
        return;
      }
      window.alert("Не удалось удалить заявку.");
    } catch (e) {
      console.error("[AccountSaleRequestDetail] delete", e);
      window.alert("Ошибка соединения.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className="mt-6 text-sm text-slate-500">Загрузка…</p>;
  if (notFound)
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-700">Заявка не найдена.</p>
        <Link href="/account/sale-requests" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          ← К списку заявок
        </Link>
      </div>
    );
  if (error) return <p className="mt-6 text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const alreadyConverted = data.status === "converted";
  const locationText = [
    data.city?.name,
    data.neighborhood?.name ?? data.district?.name,
  ]
    .filter(Boolean)
    .join(", ");

  const fieldCls =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="mt-4 space-y-6">
      <Link href="/account/sale-requests" className="inline-block text-sm text-blue-600 hover:underline">
        ← К списку заявок
      </Link>

      {/* Owner contact — CRM ONLY. Never shown on the public site. */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Контакт собственника</h2>
        <p className="mt-1 text-xs text-slate-500">
          Виден только сотрудникам. Телефон собственника не публикуется на сайте.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">ФИО</dt>
            <dd className="text-sm text-slate-900">{data.owner_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Телефон</dt>
            <dd className="text-sm font-medium text-slate-900">
              <a href={`tel:${data.owner_phone}`} className="text-blue-700 hover:underline">
                {data.owner_phone}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Локация</dt>
            <dd className="text-sm text-slate-900">{locationText || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Статус</dt>
            <dd className="text-sm text-slate-900">{data.status_label}</dd>
          </div>
        </dl>
        {alreadyConverted && data.converted_property && (
          <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Создан объект{" "}
            <Link
              href={`/account/properties/${data.converted_property}`}
              className="font-medium underline"
            >
              {data.converted_property_pid ?? `#${data.converted_property}`}
            </Link>
            .
          </div>
        )}
      </section>

      {/* Photos */}
      {data.photos.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Фотографии ({data.photos.length})
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {data.photos.map((p) => (
              <a
                key={p.id}
                href={p.image}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square overflow-hidden rounded-lg border border-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Django media URL */}
                <img src={p.image} alt="" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Editable details */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Данные объекта</h2>
        <p className="mt-1 text-xs text-slate-500">
          Можно отредактировать описание и детали перед созданием объекта.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ФИО собственника</label>
            <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} disabled={saving} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={6}
              className={`${fieldCls} resize-none`}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Тип</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                disabled={saving}
                className={fieldCls}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Площадь, м²</label>
              <Input
                value={area}
                onChange={(e) => setArea(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Комнат</label>
              <Input
                value={rooms}
                onChange={(e) => setRooms(e.target.value.replace(/\D/g, "").slice(0, 2))}
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Желаемая цена, ₽</label>
              <Input
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value.replace(/\D/g, ""))}
                disabled={saving}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={saving || alreadyConverted}
              className={`${fieldCls} max-w-xs`}
            >
              {EDITABLE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
              {alreadyConverted && <option value="converted">Создан объект</option>}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={save} disabled={saving || alreadyConverted}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
            {saveMsg && <span className="text-sm text-slate-600">{saveMsg}</span>}
          </div>
        </div>
      </section>

      {/* Actions: convert + delete */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Действия</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {alreadyConverted ? (
            <span className="text-sm text-emerald-700">
              Объект уже создан из этой заявки.
            </span>
          ) : (
            <Link
              href={`/account/properties/new?fromSubmission=${data.id}`}
              className="inline-flex items-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Создать объект
            </Link>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="inline-flex items-center rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Удаление…" : "Удалить заявку"}
            </button>
          )}
        </div>
        {!isAdmin && (
          <p className="mt-2 text-xs text-slate-400">
            Удаление заявок доступно только администратору.
          </p>
        )}
      </section>
    </div>
  );
}
