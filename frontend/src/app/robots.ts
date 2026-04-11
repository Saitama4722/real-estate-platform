import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/articleSeo";

export default function robots(): MetadataRoute.Robots {
  const base = siteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/crm", "/account"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
