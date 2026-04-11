import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/articleSeo";
import { listSeoLandingPaths } from "@/lib/catalogSeoLanding";
import { fetchPublicArticlesList, listArticlesSorted } from "@/lib/publicArticles";
import { fetchPublicPropertiesList } from "@/lib/publicPropertyList";

function toAbsolute(path: string): string {
  const origin = siteOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${encodeURI(p)}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const staticPaths = ["/", "/catalog", "/articles", "/terms", "/privacy"];

  const entries: MetadataRoute.Sitemap = [];

  for (const path of staticPaths) {
    entries.push({
      url: `${origin}${encodeURI(path)}`,
      changeFrequency: "weekly",
      priority: path === "/" ? 1 : 0.8,
    });
  }

  const [properties, articlesRaw] = await Promise.all([
    fetchPublicPropertiesList(),
    fetchPublicArticlesList(),
  ]);

  for (const p of properties) {
    const slug = p.slug?.trim() ?? "";
    if (!slug) continue;
    entries.push({
      url: toAbsolute(`/catalog/${slug}`),
      lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const a of listArticlesSorted(articlesRaw)) {
    entries.push({
      url: toAbsolute(`/articles/${a.slug}`),
      lastModified: new Date(a.publishedAt),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const path of listSeoLandingPaths()) {
    entries.push({
      url: `${origin}${encodeURI(path)}`,
      changeFrequency: "weekly",
      priority: 0.75,
    });
  }

  return entries;
}
