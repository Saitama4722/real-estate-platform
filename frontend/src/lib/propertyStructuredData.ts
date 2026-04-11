import type { PublicPropertyDetail } from "@/lib/publicProperty";
import { buildPropertyH1, propertyPageCanonicalUrl } from "@/lib/propertySeo";

const CURRENCY_CODE: Record<string, string> = {
  rub: "RUB",
  usd: "USD",
  eur: "EUR",
};

function isAbsoluteHttpUrl(s: string): boolean {
  return s.startsWith("https://") || s.startsWith("http://");
}

/** Минимальный JSON-LD `Product` + `Offer` по фактическим полям API. */
export function buildPropertyJsonLd(
  p: PublicPropertyDetail,
  pathSlug: string,
): Record<string, unknown> {
  const url = propertyPageCanonicalUrl(pathSlug);
  const name = buildPropertyH1(p);
  const desc = (p.description || p.short_description || "").trim();
  const images = p.photos
    .filter((x) => x.url && isAbsoluteHttpUrl(x.url as string))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((x) => x.url as string);

  const priceNum = Number(p.price);
  const currency = CURRENCY_CODE[p.currency] ?? p.currency.toUpperCase();

  const offers: Record<string, unknown> = {
    "@type": "Offer",
    url,
    priceCurrency: currency,
  };
  if (!Number.isNaN(priceNum)) {
    offers.price = String(priceNum);
  }

  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    url,
    offers,
  };

  if (desc) {
    node.description = desc;
  }
  if (images.length > 0) {
    node.image = images.length === 1 ? images[0] : images;
  }
  const addr = p.public_address_text?.trim();
  if (addr) {
    node.additionalProperty = {
      "@type": "PropertyValue",
      name: "location",
      value: addr,
    };
  }
  const mod = p.updated_at?.trim();
  if (mod) {
    const d = new Date(mod);
    if (!Number.isNaN(d.getTime())) {
      node.dateModified = d.toISOString();
    }
  }

  return node;
}
