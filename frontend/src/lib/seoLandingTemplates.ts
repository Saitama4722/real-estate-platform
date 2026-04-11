import type { LandingResolved } from "./catalogSeoLanding";

/** Единый суффикс заголовка окна для всех посадочных SEO-страниц каталога */
const DOCUMENT_TITLE_SUFFIX = " — Centreal";
const DOCUMENT_TITLE_MAX = 70;
const META_DESCRIPTION_MAX = 160;
const META_DESCRIPTION_TARGET_MIN = 120;

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return sp > 20 ? `${cut.slice(0, sp)}…` : `${cut}…`;
}

function padDescriptionShort(core: string): string {
  let s = core;
  const pad = " Удобный поиск и подробные карточки объектов.";
  while (s.length < META_DESCRIPTION_TARGET_MIN && s.length + pad.length <= META_DESCRIPTION_MAX) {
    s += pad;
  }
  return clip(s, META_DESCRIPTION_MAX);
}

/**
 * Шаблонный H1 по контексту посадочной страницы (предложный падеж города передаётся как `where`).
 */
export function buildSeoLandingH1(where: string, resolved: LandingResolved): string {
  switch (resolved.kind) {
    case "property_type":
      switch (resolved.propertyType) {
        case "apartment":
          return `Купить квартиру в ${where}`;
        case "house":
          return `Купить дом в ${where}`;
        case "land":
          return `Купить участок в ${where}`;
        case "commercial":
          return `Купить коммерческую недвижимость в ${where}`;
        default:
          return `Недвижимость в ${where}`;
      }
    case "rooms":
      return `Купить ${resolved.rooms}-комнатную квартиру в ${where}`;
    case "district":
      return `Купить квартиру в ${where}, район ${resolved.labelRu}`;
    case "neighborhood":
      return `Купить квартиру в ${where}, ${resolved.labelRu}`;
    case "zhk":
      return `Недвижимость в ЖК ${resolved.labelRu} в ${where}`;
    default:
      return `Недвижимость в ${where}`;
  }
}

/**
 * Заголовок вкладки (document title) по тем же переменным контекста, с общим суффиксом бренда.
 */
export function buildSeoLandingDocumentTitle(where: string, resolved: LandingResolved): string {
  const h1 = buildSeoLandingH1(where, resolved);
  const full = `${h1}${DOCUMENT_TITLE_SUFFIX}`;
  if (full.length <= DOCUMENT_TITLE_MAX) return full;
  return clip(full, DOCUMENT_TITLE_MAX);
}

/**
 * Meta description по шаблонам с учётом типа посадочной страницы и локации.
 */
export function buildSeoLandingMetaDescription(
  where: string,
  resolved: LandingResolved,
): string {
  const h1 = buildSeoLandingH1(where, resolved);
  let core: string;
  switch (resolved.kind) {
    case "property_type":
      core = `Подборка объявлений о продаже в ${where}: актуальные цены и описания на Centreal.`;
      break;
    case "rooms":
      core = `${h1}. Подборка квартир с указанным числом комнат в ${where} на Centreal.`;
      break;
    case "district":
      core = `Квартиры в районе «${resolved.labelRu}» (${where}): объявления о продаже на Centreal.`;
      break;
    case "neighborhood":
      core = `Квартиры, ${resolved.labelRu}, ${where}: продажа на Centreal.`;
      break;
    case "zhk":
      core = `Жилой комплекс «${resolved.labelRu}» в ${where}: объявления о продаже на Centreal.`;
      break;
    default:
      core = `Каталог недвижимости в ${where} на Centreal.`;
  }
  if (core.length >= META_DESCRIPTION_TARGET_MIN && core.length <= META_DESCRIPTION_MAX) return core;
  if (core.length > META_DESCRIPTION_MAX) return clip(core, META_DESCRIPTION_MAX);
  return padDescriptionShort(core);
}
