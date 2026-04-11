import Link from "next/link";
import { ARTICLE_PAGE_CATALOG_LINKS } from "@/lib/articleCatalogLinks";

export function ArticleCatalogLinksBlock() {
  return (
    <section className="mt-10 rounded-lg border border-gray-200 bg-gray-50 p-4 md:p-5">
      <h2 className="text-lg font-semibold text-gray-900">Каталог недвижимости</h2>
      <p className="mt-1 text-sm text-gray-600">
        Перейдите к объявлениям о продаже в Краснодаре и Геленджике.
      </p>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {ARTICLE_PAGE_CATALOG_LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
