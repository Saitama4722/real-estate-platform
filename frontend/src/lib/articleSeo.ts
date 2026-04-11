import type { PublicArticle } from "@/lib/publicArticles";

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

export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function buildArticleDocumentTitle(article: PublicArticle): string {
  let core = article.title.trim();
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

/** Meta description 120–160 символов, без повторения заголовка дословно. */
export function buildArticleMetaDescription(article: PublicArticle): string {
  const ex = article.excerpt.trim();
  if (ex.length >= 120 && ex.length <= 160) return ex;
  const prefix = "Материал Centreal. ";
  let s = `${prefix}${ex}`;
  if (s.length > 160) return clipSentence(s, 120, 160);
  const pad = " Полезно при выборе недвижимости в Краснодаре и Геленджике.";
  if (s.length + pad.length <= 160) s += pad;
  if (s.length < 120) {
    s = `${prefix}${article.title.trim()}. ${ex}`;
    s = clipSentence(s, 100, 160);
  }
  return clipSentence(s, 100, 160);
}

export function articleCanonicalUrl(slug: string): string {
  const path = `/articles/${encodeURI(slug.trim())}`;
  return `${siteOrigin()}${path}`;
}

export function articlesIndexCanonicalUrl(): string {
  return `${siteOrigin()}/articles`;
}

export function buildArticleJsonLd(article: PublicArticle): Record<string, unknown> {
  const url = articleCanonicalUrl(article.slug);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title.trim(),
    description: article.excerpt.trim(),
    datePublished: article.publishedAt,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    url,
    inLanguage: "ru-RU",
    publisher: {
      "@type": "Organization",
      name: "Centreal",
    },
  };
}
