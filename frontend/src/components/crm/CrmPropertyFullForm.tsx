"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DuplicateWarningModal } from "@/components/crm/DuplicateWarningModal";
import { OwnerModal, type OwnerData } from "@/components/crm/OwnerModal";
import { LocationAutocomplete } from "@/components/crm/LocationAutocomplete";
import { CrmPropertyPhotosManager } from "@/components/crm/CrmPropertyPhotosManager";
import {
  CrmStagedPhotosPicker,
  makeStagedPhoto,
  type StagedPhoto,
} from "@/components/crm/CrmStagedPhotosPicker";
import { xhrUpload } from "@/lib/xhrUpload";
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

/** Strip non-digits then insert a narrow-space every 3 digits from the right. */
function formatPrice(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Return only the digit characters from a formatted price string. */
function stripPrice(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

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

/** Character limits — kept in sync with the backend model field max_length. */
const DESCRIPTION_MAX = 3000;
const SHORT_DESCRIPTION_MAX = 500;

const NEIGHBORHOOD_LABEL_URBAN = "Микрорайон";

/**
 * Numeric-only input filtering for the property characteristics fields.
 *
 * `onKeyDown` blocks a disallowed printable character from ever appearing;
 * `onChange` sanitizes the resulting value so pastes / IME / autofill can't
 * slip non-numeric characters in either.
 *
 * - integer:  digits only (no decimal point, no sign, no exponent).
 * - decimal:  digits plus a single "." or "," as decimal separator.
 */
const NUMERIC_CONTROL_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Enter",
  "Escape",
  "Home",
  "End",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

function isEditingShortcut(e: React.KeyboardEvent<HTMLInputElement>) {
  // Allow Ctrl/Cmd combos (copy, paste, cut, select-all, etc.).
  return e.ctrlKey || e.metaKey;
}

function handleIntegerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (NUMERIC_CONTROL_KEYS.has(e.key) || isEditingShortcut(e)) return;
  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
}

function sanitizeInteger(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function handleDecimalKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (NUMERIC_CONTROL_KEYS.has(e.key) || isEditingShortcut(e)) return;
  // A single "." or "," acts as the decimal separator; block a second one.
  if (e.key === "." || e.key === ",") {
    if (/[.,]/.test(e.currentTarget.value)) e.preventDefault();
    return;
  }
  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
}

function sanitizeDecimal(value: string) {
  // Keep digits and separators, then collapse to at most one separator.
  const cleaned = value.replace(/[^0-9.,]/g, "");
  const firstSep = cleaned.search(/[.,]/);
  if (firstSep === -1) return cleaned;
  return (
    cleaned.slice(0, firstSep + 1) +
    cleaned.slice(firstSep + 1).replace(/[.,]/g, "")
  );
}

/**
 * Blur-time min enforcement for numeric fields.
 *
 * Runs ONLY on blur (never per-keystroke) so multi-digit typing is never
 * interrupted — e.g. typing "1" then "0" for "10" isn't clamped after the "1".
 * If the committed value parses to a number strictly below `min`, it is reset
 * to `min`. A blank value is left blank so required-field validation still
 * fires normally instead of being auto-filled.
 */
function clampToMin(value: string, min: number): string {
  if (value.trim() === "") return value;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n)) return value;
  return n < min ? String(min) : value;
}

type DistrictRow = { id: number; name: string; district_type: string };

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
  /**
   * Create-mode only: pre-fill this new property from a "Продать недвижимость"
   * submission (SaleRequest). On successful create, the submission is marked
   * converted and linked to the resulting Property.
   */
  fromSubmissionId?: string;
};

export function CrmPropertyFullForm({
  mode,
  propertyId,
  fromSubmissionId,
}: CrmPropertyFullFormProps) {
  const router = useRouter();
  const [propertyType, setPropertyType] = useState<CrmPropertyTypeValue>("apartment");
  const [price, setPrice] = useState("");
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [rcId, setRcId] = useState("");
  const [latitudeStr, setLatitudeStr] = useState("");
  const [longitudeStr, setLongitudeStr] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");

  const [apt, setApt] = useState<ApartmentDetailsForm>(() => emptyApartmentDetails());
  const [house, setHouse] = useState<HouseDetailsForm>(() => emptyHouseDetails());
  const [land, setLand] = useState<LandDetailsForm>(() => emptyLandDetails());
  const [comm, setComm] = useState<CommercialDetailsForm>(() => emptyCommercialDetails());

  const [cities, setCities] = useState<CityRow[]>([]);
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<{ id: number; name: string }[]>([]);
  const [rcList, setRcList] = useState<{ id: number; name: string }[]>([]);
  const [choices, setChoices] = useState<LocationsChoicesResponse | null>(null);
  const [choicesLoadError, setChoicesLoadError] = useState("");

  const [bootstrapping, setBootstrapping] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckResponse | null>(null);
  const [error, setError] = useState("");
  const [locationErrors, setLocationErrors] = useState<{ city?: string; district?: string }>({});
  const [success, setSuccess] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [meRole, setMeRole] = useState<string | null>(null);
  const [realtors, setRealtors] = useState<CrmRealtorRow[]>([]);
  const [assignedRealtorId, setAssignedRealtorId] = useState("");
  // Owner (собственник) — optional CRM link. `owner` holds the linked owner (for
  // display); `owner` id is sent in the payload. `crmPropertyId` is shown for
  // context in the owner modal (edit mode).
  const [owner, setOwner] = useState<OwnerData | null>(null);
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [crmPropertyId, setCrmPropertyId] = useState("");
  // Create mode only: photos picked before the property exists. Uploaded right
  // after the property is created (see uploadStagedPhotos).
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);

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
        setDistricts(list.map((d: { id: number; name: string; district_type: string }) => ({
          id: d.id,
          name: d.name,
          district_type: d.district_type ?? "city_district",
        })));
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
    // Clear immediately so the "Микрорайон" field (whose visibility now depends
    // on neighborhoods.length) hides at once on a district switch, then reappears
    // only if the fresh fetch returns children.
    setNeighborhoods([]);
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
      setLatitudeStr(row.public_latitude != null ? String(row.public_latitude) : "");
      setLongitudeStr(row.public_longitude != null ? String(row.public_longitude) : "");
      setDescription(typeof row.description === "string" ? row.description : "");
      setShortDescription(typeof row.short_description === "string" ? row.short_description : "");
      setAssignedRealtorId(fkId(row.assigned_realtor));
      setCrmPropertyId(typeof row.crm_property_id === "string" ? row.crm_property_id : "");
      // Owner is a nested object on the CRM detail serializer (or null).
      const ownerRow = row.owner as OwnerData | null;
      setOwner(ownerRow && typeof ownerRow === "object" ? ownerRow : null);

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

  // Convert flow: pre-fill a NEW property from a "Продать недвижимость" submission.
  // Seeds city/district/neighborhood (dependent selects self-populate off cityId),
  // description, type, price, rooms/area, and stages the submission photos as Files.
  useEffect(() => {
    if (mode !== "create" || !fromSubmissionId || !getCrmAccessToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithCrmAuthRetry(
          `/api/crm/sale-requests/${encodeURIComponent(fromSubmissionId)}/`,
        );
        if (!res.ok || cancelled) return;
        const sr = (await res.json()) as {
          description?: string;
          property_type?: string;
          area?: string | null;
          rooms?: number | null;
          asking_price?: string | null;
          city?: { id: number } | null;
          district?: { id: number } | null;
          neighborhood?: { id: number } | null;
          photos?: { id: number; image: string }[];
        };
        if (cancelled) return;

        if (sr.description) setDescription(sr.description);
        if (sr.property_type) setPropertyType(sr.property_type as CrmPropertyTypeValue);
        if (sr.asking_price != null && sr.asking_price !== "") {
          // Backend price is a decimal string like "6500000.00" — keep integer part.
          setPrice(String(sr.asking_price).split(".")[0]);
        }
        if (sr.city?.id) setCityId(String(sr.city.id));
        if (sr.district?.id) setDistrictId(String(sr.district.id));
        if (sr.neighborhood?.id) setNeighborhoodId(String(sr.neighborhood.id));
        // Rooms/area apply to the apartment detail block (the most common case).
        if (sr.property_type === "apartment") {
          setApt((a) => ({
            ...a,
            ...(sr.rooms != null ? { rooms: String(sr.rooms) } : {}),
            ...(sr.area != null && sr.area !== ""
              ? { area_total: String(sr.area).replace(/\.00$/, "") }
              : {}),
          }));
        }

        // Fetch each submission photo as a File and stage it for upload-on-create.
        const photos = Array.isArray(sr.photos) ? sr.photos : [];
        const staged: StagedPhoto[] = [];
        for (const p of photos) {
          try {
            const imgRes = await fetch(p.image);
            if (!imgRes.ok) continue;
            const blob = await imgRes.blob();
            const ext = (blob.type.split("/")[1] || "jpg").split(";")[0];
            const file = new File([blob], `sale-request-${p.id}.${ext}`, {
              type: blob.type || "image/jpeg",
            });
            staged.push(makeStagedPhoto(file));
          } catch {
            /* skip a photo that fails to fetch; not fatal */
          }
        }
        if (!cancelled && staged.length > 0) setStagedPhotos(staged);
      } catch (e) {
        console.error("[CrmPropertyFullForm] prefill from submission", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, fromSubmissionId]);

  const buildBasePayload = useCallback(() => {
    const coords = coordsPayload(latitudeStr, longitudeStr);
    const base: Record<string, unknown> = {
      price: parseFloat(price),
      city: cityId ? parseInt(cityId, 10) : null,
      district: districtId ? parseInt(districtId, 10) : null,
      neighborhood: neighborhoodId ? parseInt(neighborhoodId, 10) : null,
      residential_complex: rcId ? parseInt(rcId, 10) : null,
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
    // Owner link — optional. Send the id (or null to unlink). Omitting owner
    // entirely on PATCH would leave it unchanged, so we send it explicitly.
    base.owner = owner ? owner.id : null;
    Object.assign(base, buildDetailsPayload(propertyType, apt, house, land, comm));
    return base;
  }, [
    price,
    cityId,
    districtId,
    neighborhoodId,
    rcId,
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
    owner,
  ]);

  // Validates the required location fields (city + district). Sets per-field
  // errors and returns true when both are selected.
  const validateLocation = (): boolean => {
    const errs: { city?: string; district?: string } = {};
    if (!cityId) errs.city = "Обязательное поле";
    if (!districtId) errs.district = "Обязательное поле";
    setLocationErrors(errs);
    return !errs.city && !errs.district;
  };

  // Upload the create-mode staged photos to a freshly created property.
  // Sequential so the first file lands first and is flagged as the main photo.
  // Returns the number of photos that failed to upload.
  const uploadStagedPhotos = async (newPropertyId: number): Promise<number> => {
    let failed = 0;
    for (let i = 0; i < stagedPhotos.length; i++) {
      const photo = stagedPhotos[i];
      const fd = new FormData();
      fd.append("original_file", photo.file);
      if (i === 0) fd.append("is_main", "true");
      try {
        const res = await xhrUpload({
          url: `/api/crm/properties/${newPropertyId}/photos/`,
          method: "POST",
          body: fd,
        });
        if (!res.ok) failed += 1;
      } catch {
        failed += 1;
      }
      URL.revokeObjectURL(photo.previewUrl);
    }
    return failed;
  };

  const submitCreate = async () => {
    setError("");
    setSuccess("");
    if (!validateLocation()) return;
    if (stagedPhotos.length === 0) {
      setError("Добавьте хотя бы одно фото");
      return;
    }
    if (!price || parseFloat(price) <= 0) {
      setError("Укажите корректную цену");
      return;
    }
    if (!description.trim()) {
      setError("Заполните полное описание объекта");
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
      const photoCount = stagedPhotos.length;
      const failed = photoCount > 0 ? await uploadStagedPhotos(created.id) : 0;
      // If this property was created from a sell-your-property submission, mark
      // that submission converted and link it to the new Property (traceability).
      // A failure here must not block the successful property creation.
      if (fromSubmissionId) {
        try {
          await fetchWithCrmAuthRetry(
            `/api/crm/sale-requests/${encodeURIComponent(fromSubmissionId)}/mark-converted/`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ property_id: created.id }),
            },
          );
        } catch (e) {
          console.error("[CrmPropertyFullForm] mark-converted", e);
        }
      }
      // Property created — leave the create page and return to the list. The
      // form unmounts on navigation, so no in-place reset is needed. If some
      // photos failed to upload, pass the counts so the list can warn the user.
      if (failed > 0) {
        router.push(
          `/account/properties?photoWarn=1&failed=${failed}&total=${photoCount}`,
        );
      } else {
        router.push("/account/properties");
      }
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
    if (!validateLocation()) return;
    if (!price || parseFloat(price) <= 0) {
      setError("Укажите корректную цену");
      return;
    }
    if (!description.trim()) {
      setError("Заполните полное описание объекта");
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
    if (stagedPhotos.length === 0) {
      setDuplicateWarning(null);
      setError("Добавьте хотя бы одно фото");
      return;
    }
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
      const created = (await createRes.json()) as { id: number; title_generated?: string };
      const photoCount = stagedPhotos.length;
      const failed = photoCount > 0 ? await uploadStagedPhotos(created.id) : 0;
      const photoNote =
        photoCount === 0
          ? ""
          : failed === 0
            ? ` Загружено фотографий: ${photoCount}.`
            : ` Загружено фотографий: ${photoCount - failed} из ${photoCount} (часть не удалось).`;
      setSuccess(`Объект создан. Заголовок: ${created.title_generated ?? "—"}.${photoNote}`);
      setPropertyType("apartment");
      setPrice("");
      setCityId("");
      setDistrictId("");
      setNeighborhoodId("");
      setRcId("");
      setLatitudeStr("");
      setLongitudeStr("");
      setDescription("");
      setShortDescription("");
      setApt(emptyApartmentDetails());
      setHouse(emptyHouseDetails());
      setLand(emptyLandDetails());
      setComm(emptyCommercialDetails());
      setAssignedRealtorId("");
      setStagedPhotos([]);
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

          {/* Owner (собственник) — optional. Fill via the modal (search+reuse or
              create). A missing owner is allowed but flagged. */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Собственник
            </label>
            {owner ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="min-w-0 text-sm">
                  <span className="font-medium text-gray-900">{owner.full_name}</span>
                  <span className="ml-2 text-gray-600">{owner.phone}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOwnerModalOpen(true)}
                  className="text-xs font-medium text-blue-600 underline hover:text-blue-800"
                >
                  Изменить / заменить
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOwnerModalOpen(true)}
                  className="inline-flex items-center rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  Заполнить данные собственника
                </button>
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                  ⚠ Собственник не указан
                </span>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Необязательно, но желательно. Данные собственника видны только в CRM и
              не публикуются на сайте.
            </p>
          </div>

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
              type="text"
              inputMode="numeric"
              value={formatPrice(price)}
              onChange={(e) => {
                const el = e.currentTarget;
                const oldFormatted = el.value;
                const cursorPos = el.selectionStart ?? oldFormatted.length;
                const digitsBeforeCursor = oldFormatted.slice(0, cursorPos).replace(/\D/g, "").length;
                const newRaw = stripPrice(oldFormatted);
                setPrice(newRaw);
                requestAnimationFrame(() => {
                  if (document.activeElement !== el) return;
                  const newFormatted = formatPrice(newRaw);
                  let seen = 0;
                  let newCursor = newFormatted.length;
                  for (let i = 0; i < newFormatted.length; i++) {
                    if (/\d/.test(newFormatted[i]) && ++seen === digitsBeforeCursor) {
                      newCursor = i + 1;
                      break;
                    }
                  }
                  el.setSelectionRange(newCursor, newCursor);
                });
              }}
              onKeyDown={(e) => {
                if (/^\d$/.test(e.key) || e.ctrlKey || e.metaKey) return;
                const nav = ["Backspace","Delete","Tab","Enter","Escape",
                  "ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"];
                if (!nav.includes(e.key)) e.preventDefault();
              }}
              required
              placeholder="0"
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
                    type="text"
                    inputMode="numeric"
                    min={1}
                    value={apt.rooms}
                    onKeyDown={handleIntegerKeyDown}
                    onChange={(e) =>
                      setApt((a) => ({ ...a, rooms: sanitizeInteger(e.target.value) }))
                    }
                    onBlur={(e) =>
                      setApt((a) => ({ ...a, rooms: clampToMin(e.target.value, 1) }))
                    }
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
                    onKeyDown={handleDecimalKeyDown}
                    onChange={(e) =>
                      setApt((a) => ({ ...a, area_total: sanitizeDecimal(e.target.value) }))
                    }
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
                    onKeyDown={handleDecimalKeyDown}
                    onChange={(e) =>
                      setApt((a) => ({ ...a, area_living: sanitizeDecimal(e.target.value) }))
                    }
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
                    onKeyDown={handleDecimalKeyDown}
                    onChange={(e) =>
                      setApt((a) => ({ ...a, area_kitchen: sanitizeDecimal(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Этаж <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    min={0}
                    value={apt.floor}
                    onKeyDown={handleIntegerKeyDown}
                    onChange={(e) =>
                      setApt((a) => ({ ...a, floor: sanitizeInteger(e.target.value) }))
                    }
                    onBlur={(e) =>
                      setApt((a) => ({ ...a, floor: clampToMin(e.target.value, 0) }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Этажей в доме
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    min={1}
                    value={apt.floors_total}
                    onKeyDown={handleIntegerKeyDown}
                    onChange={(e) =>
                      setApt((a) => ({ ...a, floors_total: sanitizeInteger(e.target.value) }))
                    }
                    onBlur={(e) =>
                      setApt((a) => ({ ...a, floors_total: clampToMin(e.target.value, 1) }))
                    }
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
                    onKeyDown={handleDecimalKeyDown}
                    onChange={(e) =>
                      setHouse((h) => ({ ...h, house_area: sanitizeDecimal(e.target.value) }))
                    }
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
                    onKeyDown={handleDecimalKeyDown}
                    onChange={(e) =>
                      setHouse((h) => ({ ...h, land_area: sanitizeDecimal(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Этажей <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    min={1}
                    value={house.floors_total}
                    onKeyDown={handleIntegerKeyDown}
                    onChange={(e) =>
                      setHouse((h) => ({ ...h, floors_total: sanitizeInteger(e.target.value) }))
                    }
                    onBlur={(e) =>
                      setHouse((h) => ({ ...h, floors_total: clampToMin(e.target.value, 1) }))
                    }
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
                    onKeyDown={handleDecimalKeyDown}
                    onChange={(e) =>
                      setLand((l) => ({ ...l, land_area: sanitizeDecimal(e.target.value) }))
                    }
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
                    onKeyDown={handleDecimalKeyDown}
                    onChange={(e) =>
                      setComm((c) => ({ ...c, area_total: sanitizeDecimal(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Этаж</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    min={0}
                    value={comm.floor}
                    onKeyDown={handleIntegerKeyDown}
                    onChange={(e) =>
                      setComm((c) => ({ ...c, floor: sanitizeInteger(e.target.value) }))
                    }
                    onBlur={(e) =>
                      setComm((c) => ({ ...c, floor: clampToMin(e.target.value, 0) }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Этажей в здании
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    min={0}
                    value={comm.floors_total}
                    onKeyDown={handleIntegerKeyDown}
                    onChange={(e) =>
                      setComm((c) => ({ ...c, floors_total: sanitizeInteger(e.target.value) }))
                    }
                    onBlur={(e) =>
                      setComm((c) => ({ ...c, floors_total: clampToMin(e.target.value, 0) }))
                    }
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
                    type="text"
                    inputMode="numeric"
                    min={0}
                    value={comm.parking_spaces}
                    onKeyDown={handleIntegerKeyDown}
                    onChange={(e) =>
                      setComm((c) => ({ ...c, parking_spaces: sanitizeInteger(e.target.value) }))
                    }
                    onBlur={(e) =>
                      setComm((c) => ({ ...c, parking_spaces: clampToMin(e.target.value, 0) }))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Полное описание <span className="text-red-500">*</span>
            </label>
            <textarea
              className={textareaClass}
              rows={6}
              maxLength={DESCRIPTION_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Текст описания объекта"
            />
            <p
              className={`mt-1 text-right text-xs ${
                DESCRIPTION_MAX - description.length < 100
                  ? "text-red-500"
                  : "text-gray-500"
              }`}
            >
              {description.length} / {DESCRIPTION_MAX}
            </p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Локация и адрес</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Город<span className="text-red-500"> *</span>
                </label>
                <Select
                  value={cityId}
                  onChange={(e) => {
                    setCityId(e.target.value);
                    if (e.target.value) setLocationErrors((prev) => ({ ...prev, city: undefined }));
                  }}
                  className={locationErrors.city ? "border-red-500" : undefined}
                >
                  <option value="">— выберите —</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                {locationErrors.city && (
                  <p className="mt-1 text-sm text-red-600">{locationErrors.city}</p>
                )}
              </div>
              <LocationAutocomplete
                label="Район"
                placeholder="— начните вводить —"
                value={districtId}
                options={districts}
                disabled={!cityId}
                required
                error={locationErrors.district}
                createEndpoint={cityId ? "/api/locations/districts" : undefined}
                createExtraBody={cityId ? { city_id: parseInt(cityId, 10) } : {}}
                onChange={(id) => {
                  setDistrictId(id);
                  setNeighborhoodId("");
                  setRcId("");
                  if (id) setLocationErrors((prev) => ({ ...prev, district: undefined }));
                }}
                onCreated={(item) => setDistricts((prev) => [...prev, { ...item, district_type: "city_district" }])}
              />
              {(() => {
                const selectedDistrict = districts.find((d) => String(d.id) === districtId);
                if (!districtId || !selectedDistrict) return null;
                // Show the "Микрорайон" sub-field whenever the selected district
                // actually has neighborhoods — regardless of district_type. This
                // covers Krasnodar's city_district as well as Gelendzhik suburbs
                // like "Геленджик" that carry microdistricts, while staying hidden
                // for flat suburbs (Кабардинка, Бетта, …) that have none.
                if (neighborhoods.length === 0) return null;
                return (
                  <LocationAutocomplete
                    label={NEIGHBORHOOD_LABEL_URBAN}
                    placeholder="— начните вводить —"
                    value={neighborhoodId}
                    options={neighborhoods}
                    disabled={!cityId}
                    createEndpoint={cityId ? "/api/locations/neighborhoods" : undefined}
                    createExtraBody={{
                      ...(cityId ? { city_id: parseInt(cityId, 10) } : {}),
                      ...(districtId ? { district_id: parseInt(districtId, 10) } : {}),
                    }}
                    onChange={(id) => {
                      setNeighborhoodId(id);
                      setRcId("");
                    }}
                    onCreated={(item) => setNeighborhoods((prev) => [...prev, item])}
                  />
                );
              })()}
              <LocationAutocomplete
                label="Жилой комплекс"
                placeholder="— начните вводить —"
                value={rcId}
                options={rcList}
                disabled={!cityId}
                createEndpoint={cityId ? "/api/locations/residential-complexes" : undefined}
                createExtraBody={{
                  ...(cityId ? { city_id: parseInt(cityId, 10) } : {}),
                  ...(districtId ? { district_id: parseInt(districtId, 10) } : {}),
                  ...(neighborhoodId ? { neighborhood_id: parseInt(neighborhoodId, 10) } : {}),
                }}
                onChange={(id) => setRcId(id)}
                onCreated={(item) => setRcList((prev) => [...prev, item])}
              />
            </div>
          </div>

          <CrmPropertyAddressMap
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
              maxLength={SHORT_DESCRIPTION_MAX}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Необязательно"
            />
            <p
              className={`mt-1 text-right text-xs ${
                SHORT_DESCRIPTION_MAX - shortDescription.length < 50
                  ? "text-red-500"
                  : "text-gray-500"
              }`}
            >
              {shortDescription.length} / {SHORT_DESCRIPTION_MAX}
            </p>
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

        {/* Photos. In edit mode they attach directly (property id exists). In
            create mode they are staged in memory and uploaded right after the
            property is created (see uploadStagedPhotos). */}
        <section className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="text-base font-semibold text-slate-900">Фотографии</h2>
          {mode === "edit" && propertyId ? (
            <div className="mt-4">
              <CrmPropertyPhotosManager propertyId={propertyId} />
            </div>
          ) : (
            <div className="mt-4">
              <CrmStagedPhotosPicker
                items={stagedPhotos}
                onChange={setStagedPhotos}
                disabled={saving}
              />
            </div>
          )}
        </section>
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

      <OwnerModal
        isOpen={ownerModalOpen}
        onClose={() => setOwnerModalOpen(false)}
        propertyLabel={
          crmPropertyId || (mode === "create" ? "новый объект" : undefined)
        }
        currentOwner={owner}
        onLinked={(o) => setOwner(o)}
        onUnlinked={() => setOwner(null)}
      />
    </>
  );
}
