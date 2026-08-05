import type { PublicPropertyDetail } from "@/lib/publicProperty";
import { siteOrigin } from "@/lib/articleSeo";
import { formatGroupedNumber, formatPriceRub } from "@/lib/formatPrice";

export function propertyPageCanonicalUrl(pathSlug: string): string {
  const s = pathSlug.trim();
  return `${siteOrigin()}/catalog/${encodeURI(s)}`;
}

const CURRENCY_LABEL: Record<string, string> = {
  rub: "₽",
  usd: "$",
  eur: "€",
};

function cityName(p: PublicPropertyDetail): string {
  return p.city?.name?.trim() || "";
}

function districtName(p: PublicPropertyDetail): string {
  return p.district?.name?.trim() || "";
}

function districtSuffix(p: PublicPropertyDetail): string {
  const d = districtName(p);
  return d ? `, район ${d}` : "";
}

function typePhraseNominative(p: PublicPropertyDetail): string {
  const ad = p.apartment_details;
  const ld = p.land_plot_details;

  switch (p.property_type) {
    case "apartment":
      if (ad?.rooms != null) {
        return `${ad.rooms}-комнатная квартира`;
      }
      return "Квартира";
    case "house":
      return "Дом";
    case "land":
      if (ld?.land_area != null) {
        const n = formatDecimal(ld.land_area);
        return `Участок ${n} сот.`;
      }
      return "Участок";
    case "commercial":
      return "Коммерческое помещение";
    default:
      return "Объект недвижимости";
  }
}

function typePhraseAccusativeForTitle(p: PublicPropertyDetail): string {
  const ad = p.apartment_details;
  switch (p.property_type) {
    case "apartment":
      if (ad?.rooms != null) {
        return `${ad.rooms}-комнатную квартиру`;
      }
      return "квартиру";
    case "house":
      return "дом";
    case "land":
      return "участок";
    case "commercial":
      return "коммерческое помещение";
    default:
      return "объект недвижимости";
  }
}

function formatDecimal(v: string): string {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return String(n).replace(/\.?0+$/, "");
}

function clipSentence(s: string, minLen: number, maxLen: number): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen - 1);
  const sp = cut.lastIndexOf(" ");
  if (sp >= minLen) return `${cut.slice(0, sp)}…`;
  return `${cut}…`;
}

/** SEO H1: тип, комнаты/площадь при наличии, город, район. */
export function buildPropertyH1(p: PublicPropertyDetail): string {
  const city = cityName(p);
  const type = typePhraseNominative(p);
  const loc = city ? ` в ${city}` : "";
  const dist = districtSuffix(p);
  if (p.property_type === "apartment") {
    return `${type}${loc}${dist}`;
  }
  if (p.property_type === "house" && p.house_details) {
    const ha = formatDecimal(p.house_details.house_area);
    const la = formatDecimal(p.house_details.land_area);
    return `Дом ${ha} м², участок ${la} сот.${loc}${dist}`;
  }
  if (p.property_type === "commercial" && p.commercial_details?.area_total) {
    const a = formatDecimal(p.commercial_details.area_total);
    return `Коммерческое помещение ${a} м²${loc}${dist}`;
  }
  return `${type}${loc}${dist}`;
}

const TITLE_SUFFIX = " — цена, фото, описание";

/** Meta title ~50–70 символов. */
export function buildPropertyPageTitle(p: PublicPropertyDetail): string {
  const city = cityName(p);
  const acc = typePhraseAccusativeForTitle(p);
  const inCity = city ? ` в ${city}` : "";
  let core = `Купить ${acc}${inCity}`;
  let full = `${core}${TITLE_SUFFIX}`;
  if (full.length > 70) {
    const budget = 70 - TITLE_SUFFIX.length;
    core = clipSentence(core, 12, Math.max(12, budget));
    full = `${core}${TITLE_SUFFIX}`;
  }
  return full.length > 70 ? clipSentence(full, 35, 70) : full;
}

/** Meta description 120–160 символов. */
export function buildPropertyMetaDescription(p: PublicPropertyDetail): string {
  const h = buildPropertyH1(p);
  const tail = " Цена, фото, характеристики. Оставьте заявку онлайн.";
  let s = `Продаётся ${h}.${tail}`;
  if (s.length >= 120 && s.length <= 160) return s;
  if (s.length > 160) return clipSentence(s, 120, 160);
  const pad = " Подробности на сайте.";
  while (s.length < 120 && s.length + pad.length <= 160) {
    s += pad;
  }
  return clipSentence(s, 100, 160);
}

/*
 * Through the shared formatters (ASCII-space convention, review finding 14) —
 * this and the list mapper's formatListPrice must render an identical string
 * for the same amount, or the same card differs between the list and
 * favorites/compare hydration paths.
 */
export function formatPropertyPrice(p: PublicPropertyDetail): string {
  const n = Number(p.price);
  if (p.currency === "rub" && Number.isFinite(n)) return formatPriceRub(n);
  const sym = CURRENCY_LABEL[p.currency] ?? p.currency;
  if (Number.isNaN(n)) return `${p.price} ${sym}`;
  return `${formatGroupedNumber(n)} ${sym}`;
}
