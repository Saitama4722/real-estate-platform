import type {
  PublicDistrictGuide,
  PublicDistrictGuideDetail,
} from "@/lib/publicDistrictGuides";
import { siteOrigin } from "@/lib/articleSeo";

const TITLE_SUFFIX = " — Centreal";
const MAX_DOC_TITLE_LEN = 70;

function clipSentence(s: string, minLen: number, maxLen: number): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen - 1);
  const sp = cut.lastIndexOf(" ");
  if (sp >= minLen) return `${cut.slice(0, sp)}…`;
  return `${cut}…`;
}

export function buildGuideDocumentTitle(guide: PublicDistrictGuide): string {
  let core = guide.title.trim();
  let full = `${core}${TITLE_SUFFIX}`;
  if (full.length > MAX_DOC_TITLE_LEN) {
    const budget = MAX_DOC_TITLE_LEN - TITLE_SUFFIX.length;
    core = clipSentence(core, 12, Math.max(12, budget));
    full = `${core}${TITLE_SUFFIX}`;
  }
  return full.length > MAX_DOC_TITLE_LEN
    ? clipSentence(full, 35, MAX_DOC_TITLE_LEN)
    : full;
}

/** Meta description 120–160 символов, из анонса гида. */
export function buildGuideMetaDescription(guide: PublicDistrictGuide): string {
  const ex = guide.excerpt.trim();
  if (ex.length >= 120 && ex.length <= 160) return ex;
  const prefix = "Гид Centreal по району. ";
  let s = `${prefix}${ex}`;
  if (s.length > 160) return clipSentence(s, 120, 160);
  const pad = " Смотрите объекты в этом районе на Centreal.";
  if (s.length + pad.length <= 160) s += pad;
  return clipSentence(s, 100, 160);
}

export function guideCanonicalUrl(slug: string): string {
  const path = `/districts/${encodeURI(slug.trim())}`;
  return `${siteOrigin()}${path}`;
}

export function districtsIndexCanonicalUrl(): string {
  return `${siteOrigin()}/districts`;
}

/**
 * JSON-LD for a district guide. Modeled as schema.org Article — the content is
 * editorial prose about an area, same shape as the blog articles. We deliberately
 * do NOT use Place/LocalBusiness: we have no verified geo-coordinates or address
 * for the guide itself, so an Article type is the honest, non-mismatched choice.
 */
export function buildGuideJsonLd(
  guide: PublicDistrictGuideDetail,
): Record<string, unknown> {
  const url = guideCanonicalUrl(guide.slug);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title.trim(),
    description: guide.excerpt.trim(),
    datePublished: guide.publishedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    inLanguage: "ru-RU",
    publisher: { "@type": "Organization", name: "Centreal" },
  };
}
