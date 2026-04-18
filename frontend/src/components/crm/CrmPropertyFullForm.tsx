"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DuplicateWarningModal } from "@/components/crm/DuplicateWarningModal";
import {
  authBearerHeaders,
  fetchWithCrmAuthRetry,
  getCrmAccessToken,
  refreshCrmAccessToken,
} from "@/lib/crmAuth";
import { crmBrowserApiUrl, employeeAuthAbsoluteUrl } from "@/lib/crmAuthConstants";
import {
  type ApartmentDetailsForm,
  type ChoiceItem,
  type CityRow,
  type CommercialDetailsForm,
  type CrmPropertyTypeValue,
  type HouseDetailsForm,
  type LandDetailsForm,
  type LocationsChoicesResponse,
  buildDetailsPayload,
  buildDuplicateCheckExtras,
  coordsPayload,
  CRM_PROPERTY_TYPE_LABELS,
  CRM_PROPERTY_TYPE_VALUES,
  emptyApartmentDetails,
  emptyCommercialDetails,
  emptyHouseDetails,
  emptyLandDetails,
  parseDetailFromApi,
  validateDetailsForSubmit,
} from "@/lib/crmPropertyForm";

const CrmPropertyAddressMap = dynamic(
  () =>
    import("@/components/crm/CrmPropertyAddressMap").then((m) => ({
      default: m.CrmPropertyAddressMap,
    })),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-gray-500">Загрузка блока адреса и карты…</p>
    ),
  },
);

interface DuplicateCandidate {
  id: number;
  title: string;
  price: string;
  location: string;
  status: string;
  score: number;
  reasons: string[];
}

interface DuplicateCheckResponse {
  has_warnings: boolean;
  likely_duplicates: DuplicateCandidate[];
  suspicious: DuplicateCandidate[];
}

type MeRole = { role: string };
type CrmRealtorRow = { id: number; first_name: string; last_name: string; email: string };

function isStaffRole(role: string) {
  return role === "admin" || role === "superadmin";
}

function fkId(v: unknown): string {
  if (v && typeof v === "object" && "id" in v && (v as { id: unknown }).id != null) {
    return String((v as { id: number }).id);
  }
  return "";
}

const textareaClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function SelectChoices({
  label,
  value,
  onChange,
  choices,
  placeholder = "— не выбрано —",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  choices: ChoiceItem[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export type CrmPropertyFullFormProps = {
  mode: "create" | "edit";
  propertyId?: string;
};

export function CrmPropertyFullForm({ mode, propertyId }: CrmPropertyFullFormProps) {
  const [propertyType, setPropertyType] = useState<CrmPropertyTypeValue>("apartment");
  const [price, setPrice] = useState("");
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [rcId, setRcId] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [publicAddressText, setPublicAddressText] = useState("");
  const [hideExactAddress, setHideExactAddress] = useState(false);
  const [latitudeStr, setLatitudeStr] = useState("");
  const [longitudeStr, setLongitudeStr] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");

  const [apt, setApt] = useState<ApartmentDetailsForm>(() => emptyApartmentDetails());
  const [house, setHouse] = useState<HouseDetailsForm>(() => emptyHouseDetails());
  const [land, setLand] = useState<LandDetailsForm>(() => emptyLandDetails());
  const [comm, setComm] = useState<CommercialDetailsForm>(() => emptyCommercialDetails());

  const [cities, setCities] = useState<CityRow[]>([]);
  const [districts, setDistricts] = useState<{ id: number; name: string }[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<{ id: number; name: string }[]>([]);
  const [rcList, setRcList] = useState<{ id: number; name: string }[]>([]);
  const [choices, setChoices] = useState<LocationsChoicesResponse | null>(null);
  const [choicesLoadError, setChoicesLoadError] = useState("");

  const [bootstrapping, setBootstrapping] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckResponse | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [meRole, setMeRole] = useState<string | null>(null);
  const [realtors, setRealtors] = useState<CrmRealtorRow[]>([]);
  const [assignedRealtorId, setAssignedRealtorId] = useState("");

  const title = mode === "create" ? "Создать объект недвижимости" : "Редактировать объект";

  useEffect(() => {
    setNeedsLogin(!getCrmAccessToken());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setChoicesLoadError("");
        const jsonHeaders = { Accept: "application/json" };

        const ch = await fetch(crmBrowserApiUrl("/api/locations/choices/"), {
          headers: jsonHeaders,
        });
        if (cancelled) return;
        if (!ch.ok) {
          console.error(`[CrmPropertyFullForm] choices HTTP ${ch.status}`);
          setChoicesLoadError("Не удалось загрузить справочники для полей формы.");
          return;
        }
        const choicesData = (await ch.json()) as LocationsChoicesResponse;
        if (!cancelled) setChoices(choicesData);

        const c = await fetch(crmBrowserApiUrl("/api/locations/cities/"), {
          headers: jsonHeaders,
        });
        if (cancelled) return;
        if (!c.ok) {
          console.error(`[CrmPropertyFullForm] cities HTTP ${c.status}`);
          setChoicesLoadError("Не удалось загрузить список городов.");
          return;
        }
        const list = (await c.json()) as CityRow[];
        if (!cancelled) setCities(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error("[CrmPropertyFullForm] choices/cities network error:", e);
        if (!cancelled) setChoicesLoadError("Ошибка сети при загрузке справочников.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!getCrmAccessToken()) {
      setMeRole(null);
      setRealtors([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const fetchMe = () =>
          fetch(employeeAuthAbsoluteUrl("me"), { headers: authBearerHeaders() });
        let mr = await fetchMe();
        if (mr.status === 401) {
          if (await refreshCrmAccessToken()) mr = await fetchMe();
        }
        if (!mr.ok || cancelled) return;
        const m = (await mr.json()) as MeRole;
        if (cancelled) return;
        setMeRole(m.role);
        if (isStaffRole(m.role)) {
          const rr = await fetchWithCrmAuthRetry("/api/crm/realtors/");
          if (!rr.ok || cancelled) return;
          const list = (await rr.json()) as CrmRealtorRow[];
          if (cancelled) return;
          setRealtors(Array.isArray(list) ? list : []);
        } else {
          setRealtors([]);
        }
      } catch (e) {
        console.error("[CrmPropertyFullForm] me/realtors", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cityId) {
      setDistricts([]);
      setDistrictId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          crmBrowserApiUrl(`/api/locations/districts/?city=${encodeURIComponent(cityId)}`),
        );
        if (!r.ok || cancelled) return;
        const raw = await r.json();
        const list = Array.isArray(raw) ? raw : [];
        if (cancelled) return;
        setDistricts(list.map((d: { id: number; name: string }) => ({ id: d.id, name: d.name })));
      } catch (e) {
        console.error("[CrmPropertyFullForm] districts", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  useEffect(() => {
    if (!cityId) {
      setNeighborhoods([]);
      setNeighborhoodId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let url = `/api/locations/neighborhoods/?city=${encodeURIComponent(cityId)}`;
        if (districtId) url += `&district=${encodeURIComponent(districtId)}`;
        const r = await fetch(crmBrowserApiUrl(url));
        if (!r.ok || cancelled) return;
        const raw = await r.json();
        const list = Array.isArray(raw) ? raw : [];
        if (cancelled) return;
        setNeighborhoods(list.map((n: { id: number; name: string }) => ({ id: n.id, name: n.name })));
      } catch (e) {
        console.error("[CrmPropertyFullForm] neighborhoods", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cityId, districtId]);

  useEffect(() => {
    if (!cityId) {
      setRcList([]);
      setRcId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let url = `/api/locations/residential-complexes/?city=${encodeURIComponent(cityId)}`;
        if (districtId) url += `&district=${encodeURIComponent(districtId)}`;
        const r = await fetch(crmBrowserApiUrl(url));
        if (!r.ok || cancelled) return;
        const raw = await r.json();
        const list = Array.isArray(raw) ? raw : [];
        if (cancelled) return;
        setRcList(list.map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })));
      } catch (e) {
        console.error("[CrmPropertyFullForm] rc", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cityId, districtId]);

  const loadProperty = useCallback(async () => {
    if (mode !== "edit" || !propertyId || !getCrmAccessToken()) return;
    setBootstrapping(true);
    setError("");
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/properties/${propertyId}/`);
      if (!res.ok) {
        setError(res.status === 404 ? "Объект не найден." : "Не удалось загрузить объект.");
        setBootstrapping(false);
        return;
      }
      const row = (await res.json()) as Record<string, unknown>;
      const pt = row.property_type as CrmPropertyTypeValue;
      if (CRM_PROPERTY_TYPE_VALUES.includes(pt)) {
        setPropertyType(pt);
      }
      setPrice(row.price != null ? String(row.price) : "");
      setCityId(fkId(row.city));
      setDistrictId(fkId(row.district));
      setNeighborhoodId(fkId(row.neighborhood));
      setRcId(fkId(row.residential_complex));
      setStreet(typeof row.street === "string" ? row.street : "");
      setHouseNumber(typeof row.house_number === "string" ? row.house_number : "");
      setPublicAddressText(
        typeof row.public_address_text === "string" ? row.public_address_text : "",
      );
      setHideExactAddress(Boolean(row.hide_exact_address));
      setLatitudeStr(row.public_latitude != null ? String(row.public_latitude) : "");
      setLongitudeStr(row.public_longitude != null ? String(row.public_longitude) : "");
      setDescription(typeof row.description === "string" ? row.description : "");
      setShortDescription(typeof row.short_description === "string" ? row.short_description : "");
      setAssignedRealtorId(fkId(row.assigned_realtor));

      const parsed = parseDetailFromApi(
        (CRM_PROPERTY_TYPE_VALUES.includes(pt) ? pt : "apartment") as CrmPropertyTypeValue,
        row,
      );
      setApt(parsed.apt);
      setHouse(parsed.house);
      setLand(parsed.land);
      setComm(parsed.comm);
    } catch (e) {
      console.error("[CrmPropertyFullForm] load", e);
      setError("Ошибка соединения.");
    } finally {
      setBootstrapping(false);
    }
  }, [mode, propertyId]);

  useEffect(() => {
    void loadProperty();
  }, [loadProperty]);

  const buildBasePayload = useCallback(() => {
    const coords = coordsPayload(latitudeStr, longitudeStr);
    const base: Record<string, unknown> = {
      price: parseFloat(price),
      city: cityId ? parseInt(cityId, 10) : null,
      district: districtId ? parseInt(districtId, 10) : null,
      neighborhood: neighborhoodId ? parseInt(neighborhoodId, 10) : null,
      residential_complex: rcId ? parseInt(rcId, 10) : null,
      street: street.trim(),
      house_number: houseNumber.trim(),
      public_address_text: publicAddressText.trim(),
      hide_exact_address: hideExactAddress,
      description: description,
      short_description: shortDescription.trim(),
      public_latitude: coords.public_latitude,
      public_longitude: coords.public_longitude,
      real_latitude: coords.real_latitude,
      real_longitude: coords.real_longitude,
    };
    if (mode === "create") {
      base.property_type = propertyType;
    } else {
      base.property_type = propertyType;
    }
    if (meRole && isStaffRole(meRole) && assignedRealtorId) {
      base.assigned_realtor = parseInt(assignedRealtorId, 10);
    }
    Object.assign(base, buildDetailsPayload(propertyType, apt, house, land, comm));
    return base;
  }, [
    price,
    cityId,
    districtId,
    neighborhoodId,
    rcId,
    street,
    houseNumber,
    publicAddressText,
    hideExactAddress,
    latitudeStr,
    longitudeStr,
    description,
    shortDescription,
    mode,
    propertyType,
    apt,
    house,
    land,
    comm,
    meRole,
    assignedRealtorId,
  ]);

  const submitCreate = async () => {
    setError("");
    setSuccess("");
    if (!price || parseFloat(price) <= 0) {
      setError("Укажите корректную цену");
      return;
    }
    const detErr = validateDetailsForSubmit(propertyType, apt, house, land, comm);
    if (detErr) {
      setError(detErr);
      return;
    }
    if (meRole && isStaffRole(meRole)) {
      const rid = assignedRealtorId ? parseInt(assignedRealtorId, 10) : NaN;
      if (!Number.isFinite(rid) || rid < 1) {
        setError("Выберите ответственного риэлтора");
        return;
      }
    }

    setSaving(true);
    try {
      const base = buildBasePayload();
      const checkPayload: Record<string, unknown> = {
        property_type: propertyType,
        price: base.price,
        city: base.city,
        district: base.district,
        street: base.street,
        house_number: base.house_number,
        ...buildDuplicateCheckExtras(propertyType, apt, house, land, comm),
      };

      const checkRes = await fetchWithCrmAuthRetry("/api/crm/properties/check_duplicates/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkPayload),
      });
      if (!checkRes.ok) throw new Error("Ошибка проверки дублей");
      const checkData = (await checkRes.json()) as DuplicateCheckResponse;
      if (checkData.has_warnings) {
        setDuplicateWarning(checkData);
        setSaving(false);
        return;
      }

      const createRes = await fetchWithCrmAuthRetry("/api/crm/properties/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(base),
      });
      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        const msg =
          typeof (errData as { detail?: string }).detail === "string"
            ? (errData as { detail: string }).detail
            : "Не удалось создать объект";
        throw new Error(msg);
      }
      const created = (await createRes.json()) as { id: number; title_generated?: string };
      setSuccess(
        `Объект создан. Заголовок: ${created.title_generated ?? "—"}. Откройте карточку для дальнейшей правки.`,
      );
      setPropertyType("apartment");
      setPrice("");
      setCityId("");
      setDistrictId("");
      setNeighborhoodId("");
      setRcId("");
      setStreet("");
      setHouseNumber("");
      setPublicAddressText("");
      setHideExactAddress(false);
      setLatitudeStr("");
      setLongitudeStr("");
      setDescription("");
      setShortDescription("");
      setApt(emptyApartmentDetails());
      setHouse(emptyHouseDetails());
      setLand(emptyLandDetails());
      setComm(emptyCommercialDetails());
      setAssignedRealtorId("");
    } catch (err) {
      console.error("[CrmPropertyFullForm] create", err);
      setError(err instanceof Error ? err.message : "Ошибка при создании объекта");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!propertyId) return;
    setError("");
    setSuccess("");
    if (!price || parseFloat(price) <= 0) {
      setError("Укажите корректную цену");
      return;
    }
    const detErr = validateDetailsForSubmit(propertyType, apt, house, land, comm);
    if (detErr) {
      setError(detErr);
      return;
    }
    if (meRole && isStaffRole(meRole)) {
      const rid = assignedRealtorId ? parseInt(assignedRealtorId, 10) : NaN;
      if (!Number.isFinite(rid) || rid < 1) {
        setError("Выберите ответственного риэлтора");
        return;
      }
    }

    setSaving(true);
    try {
      const base = buildBasePayload();
      const res = await fetchWithCrmAuthRetry(`/api/crm/properties/${propertyId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(base),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg =
          typeof (errData as { detail?: string }).detail === "string"
            ? (errData as { detail: string }).detail
            : "Не удалось сохранить";
        throw new Error(msg);
      }
      const updated = (await res.json()) as { title_generated?: string };
      setSuccess(`Сохранено. Заголовок: ${updated.title_generated ?? "—"}`);
      await loadProperty();
    } catch (err) {
      console.error("[CrmPropertyFullForm] edit", err);
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "create") void submitCreate();
    else void submitEdit();
  };

  const handleConfirmCreate = async () => {
    setDuplicateWarning(null);
    setSaving(true);
    setError("");
    try {
      const base = buildBasePayload();
      const createRes = await fetchWithCrmAuthRetry("/api/crm/properties/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(base),
      });
      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        const msg =
          typeof (errData as { detail?: string }).detail === "string"
            ? (errData as { detail: string }).detail
            : "Не удалось создать объект";
        throw new Error(msg);
      }
      const created = (await createRes.json()) as { title_generated?: string };
      setSuccess(`Объект создан. Заголовок: ${created.title_generated ?? "—"}.`);
      setPropertyType("apartment");
      setPrice("");
      setCityId("");
      setDistrictId("");
      setNeighborhoodId("");
      setRcId("");
      setStreet("");
      setHouseNumber("");
      setPublicAddressText("");
      setHideExactAddress(false);
      setLatitudeStr("");
      setLongitudeStr("");
      setDescription("");
      setShortDescription("");
      setApt(emptyApartmentDetails());
      setHouse(emptyHouseDetails());
      setLand(emptyLandDetails());
      setComm(emptyCommercialDetails());
      setAssignedRealtorId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при создании объекта");
    } finally {
      setSaving(false);
    }
  };

  const renovationChoices = choices?.renovation_types ?? [];
  const bathroomChoices = choices?.bathroom_types ?? [];
  const heatingChoices = choices?.heating_types ?? [];
  const buildingChoices = choices?.building_types ?? [];
  const landCatChoices = choices?.land_categories ?? [];
  const permittedChoices = choices?.permitted_uses ?? [];
  const commercialChoices = choices?.commercial_types ?? [];

  if (mode === "edit" && bootstrapping) {
    return (
      <div className="max-w-3xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600">Загрузка…</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-3xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        <p className="mb-4 text-sm text-gray-600">
          Заголовок объекта формируется на сервере автоматически из типа, характеристик и города;
          отдельное поле «название» не требуется.
        </p>

        {choicesLoadError ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {choicesLoadError}
          </div>
        ) : null}

        {needsLogin && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Для работы с объектом{" "}
            <Link href="/account/login" className="font-medium text-amber-950 underline">
              войдите в CRM
            </Link>
            .
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {meRole && isStaffRole(meRole) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ответственный риэлтор <span className="text-red-500">*</span>
              </label>
              <Select
                value={assignedRealtorId}
                onChange={(e) => setAssignedRealtorId(e.target.value)}
                required
              >
                <option value="">— выберите —</option>
                {realtors.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.last_name} {r.first_name} ({r.email})
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип недвижимости <span className="text-red-500">*</span>
            </label>
            <Select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as CrmPropertyTypeValue)}
              required
              disabled={mode === "edit"}
            >
              {CRM_PROPERTY_TYPE_VALUES.map((v) => (
                <option key={v} value={v}>
                  {CRM_PROPERTY_TYPE_LABELS[v]}
                </option>
              ))}
            </Select>
            {mode === "edit" && (
              <p className="mt-1 text-xs text-gray-500">Тип объекта после создания не меняется.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Цена (₽) <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Характеристики</h3>
            {propertyType === "apartment" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Комнат <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={apt.rooms}
                    onChange={(e) => setApt((a) => ({ ...a, rooms: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Общая площадь, м² <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={apt.area_total}
                    onChange={(e) => setApt((a) => ({ ...a, area_total: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Жилая площадь, м²
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={apt.area_living}
                    onChange={(e) => setApt((a) => ({ ...a, area_living: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Кухня, м²
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={apt.area_kitchen}
                    onChange={(e) => setApt((a) => ({ ...a, area_kitchen: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Этаж <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={apt.floor}
                    onChange={(e) => setApt((a) => ({ ...a, floor: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Этажей в доме <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={apt.floors_total}
                    onChange={(e) => setApt((a) => ({ ...a, floors_total: e.target.value }))}
                  />
                </div>
                <SelectChoices
                  label="Ремонт"
                  value={apt.renovation_type}
                  onChange={(v) => setApt((a) => ({ ...a, renovation_type: v }))}
                  choices={renovationChoices}
                />
                <SelectChoices
                  label="Санузел"
                  value={apt.bathroom_type}
                  onChange={(v) => setApt((a) => ({ ...a, bathroom_type: v }))}
                  choices={bathroomChoices}
                />
                <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
                  <Checkbox
                    id="apt-balcony"
                    label="Балкон"
                    checked={apt.has_balcony}
                    onChange={(e) => setApt((a) => ({ ...a, has_balcony: e.target.checked }))}
                  />
                  <Checkbox
                    id="apt-loggia"
                    label="Лоджия"
                    checked={apt.has_loggia}
                    onChange={(e) => setApt((a) => ({ ...a, has_loggia: e.target.checked }))}
                  />
                </div>
              </div>
            )}

            {propertyType === "house" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Площадь дома, м² <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={house.house_area}
                    onChange={(e) => setHouse((h) => ({ ...h, house_area: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Участок, сот. <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={house.land_area}
                    onChange={(e) => setHouse((h) => ({ ...h, land_area: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Этажей <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={house.floors_total}
                    onChange={(e) => setHouse((h) => ({ ...h, floors_total: e.target.value }))}
                  />
                </div>
                <SelectChoices
                  label="Отопление"
                  value={house.heating_type}
                  onChange={(v) => setHouse((h) => ({ ...h, heating_type: v }))}
                  choices={heatingChoices}
                />
                <SelectChoices
                  label="Тип дома"
                  value={house.building_type}
                  onChange={(v) => setHouse((h) => ({ ...h, building_type: v }))}
                  choices={buildingChoices}
                />
                <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
                  <Checkbox
                    id="h-gas"
                    label="Газ"
                    checked={house.has_gas}
                    onChange={(e) => setHouse((h) => ({ ...h, has_gas: e.target.checked }))}
                  />
                  <Checkbox
                    id="h-water"
                    label="Вода"
                    checked={house.has_water}
                    onChange={(e) => setHouse((h) => ({ ...h, has_water: e.target.checked }))}
                  />
                  <Checkbox
                    id="h-sew"
                    label="Канализация"
                    checked={house.has_sewerage}
                    onChange={(e) => setHouse((h) => ({ ...h, has_sewerage: e.target.checked }))}
                  />
                  <Checkbox
                    id="h-el"
                    label="Электричество"
                    checked={house.has_electricity}
                    onChange={(e) => setHouse((h) => ({ ...h, has_electricity: e.target.checked }))}
                  />
                </div>
              </div>
            )}

            {propertyType === "land" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Площадь участка, сот. <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={land.land_area}
                    onChange={(e) => setLand((l) => ({ ...l, land_area: e.target.value }))}
                  />
                </div>
                <SelectChoices
                  label="Категория земли"
                  value={land.land_category}
                  onChange={(v) => setLand((l) => ({ ...l, land_category: v }))}
                  choices={landCatChoices}
                />
                <SelectChoices
                  label="Разрешённое использование"
                  value={land.permitted_use}
                  onChange={(v) => setLand((l) => ({ ...l, permitted_use: v }))}
                  choices={permittedChoices}
                />
                <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
                  <Checkbox
                    id="l-gas"
                    label="Газ"
                    checked={land.has_gas}
                    onChange={(e) => setLand((l) => ({ ...l, has_gas: e.target.checked }))}
                  />
                  <Checkbox
                    id="l-water"
                    label="Вода"
                    checked={land.has_water}
                    onChange={(e) => setLand((l) => ({ ...l, has_water: e.target.checked }))}
                  />
                  <Checkbox
                    id="l-el"
                    label="Электричество"
                    checked={land.has_electricity}
                    onChange={(e) => setLand((l) => ({ ...l, has_electricity: e.target.checked }))}
                  />
                </div>
              </div>
            )}

            {propertyType === "commercial" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectChoices
                  label="Тип коммерции"
                  value={comm.commercial_type}
                  onChange={(v) => setComm((c) => ({ ...c, commercial_type: v }))}
                  choices={commercialChoices}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Площадь, м² <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={comm.area_total}
                    onChange={(e) => setComm((c) => ({ ...c, area_total: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Этаж</label>
                  <Input
                    type="number"
                    min={0}
                    value={comm.floor}
                    onChange={(e) => setComm((c) => ({ ...c, floor: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Этажей в здании
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={comm.floors_total}
                    onChange={(e) => setComm((c) => ({ ...c, floors_total: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип входа</label>
                  <Input
                    value={comm.entrance_type}
                    onChange={(e) => setComm((c) => ({ ...c, entrance_type: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Парковочных мест
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={comm.parking_spaces}
                    onChange={(e) => setComm((c) => ({ ...c, parking_spaces: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Полное описание
            </label>
            <textarea
              className={textareaClass}
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Текст описания объекта"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Локация и адрес</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
                <Select value={cityId} onChange={(e) => setCityId(e.target.value)}>
                  <option value="">— выберите —</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Район</label>
                <Select
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  disabled={!cityId}
                >
                  <option value="">— выберите —</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Микрорайон
                </label>
                <Select
                  value={neighborhoodId}
                  onChange={(e) => setNeighborhoodId(e.target.value)}
                  disabled={!cityId}
                >
                  <option value="">— выберите —</option>
                  {neighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Жилой комплекс
                </label>
                <Select value={rcId} onChange={(e) => setRcId(e.target.value)} disabled={!cityId}>
                  <option value="">— выберите —</option>
                  {rcList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Улица</label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Номер дома</label>
                <Input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
              </div>
            </div>
            <Checkbox
              id="hide-exact"
              label="Скрыть точный адрес на сайте"
              checked={hideExactAddress}
              onChange={(e) => setHideExactAddress(e.target.checked)}
            />
          </div>

          <CrmPropertyAddressMap
            addressText={publicAddressText}
            onAddressTextChange={setPublicAddressText}
            latitudeStr={latitudeStr}
            longitudeStr={longitudeStr}
            onLatitudeChange={setLatitudeStr}
            onLongitudeChange={setLongitudeStr}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Краткое описание
            </label>
            <textarea
              className={textareaClass}
              rows={3}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Необязательно"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <div>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Сохранение…"
                : mode === "create"
                  ? "Создать объект"
                  : "Сохранить изменения"}
            </Button>
          </div>
        </form>
      </div>

      {duplicateWarning && (
        <DuplicateWarningModal
          isOpen={true}
          onClose={() => {
            setDuplicateWarning(null);
            setSaving(false);
          }}
          onConfirm={() => void handleConfirmCreate()}
          likelyDuplicates={duplicateWarning.likely_duplicates}
          suspicious={duplicateWarning.suspicious}
        />
      )}
    </>
  );
}
