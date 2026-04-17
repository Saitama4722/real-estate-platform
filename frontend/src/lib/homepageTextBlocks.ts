import { getPublicApiBaseUrl } from "@/lib/publicProperty";

/** Must match backend `HOMEPAGE_TEXT_BLOCK_DEFINITIONS` keys. */
export const HOMEPAGE_TEXT_FALLBACKS = {
  hero_title: "Найдите недвижимость вашей мечты",
  hero_subtitle: "Квартиры, дома, участки и коммерция в Краснодаре и Геленджике",
  inquiry_section_title: "Остались вопросы?",
  inquiry_section_subtitle:
    "Напишите нам — подскажем по каталогу и подбору объекта.",
  inquiry_button_label: "Задать вопрос",
  inquiry_modal_title: "Задать вопрос",
  inquiry_modal_subtitle:
    "Оставьте контакты — мы перезвоним и ответим на ваш вопрос.",
  categories_section_title: "Категории",
  properties_section_title: "Новые объекты",
  map_section_title: "Объекты на карте",
  map_empty_message:
    "Нет объектов с координатами для отображения на карте",
  articles_section_title: "Статьи",
  seo_section_title: "Недвижимость в Краснодарском крае",
  seo_section_body:
    "Centreal помогает купить недвижимость в Краснодаре и Геленджике: квартиры, дома, участки и коммерческие помещения. На сайте — актуальный каталог опубликованных объектов, статьи для покупателей и форма заявки по выбранному объекту.",
} as const;

export type HomepageTextBlockKey = keyof typeof HOMEPAGE_TEXT_FALLBACKS;

type BlockRow = { key: string; value: string };

function normalizeBlocksPayload(data: unknown): BlockRow[] {
  if (!data || typeof data !== "object") return [];
  const raw = (data as { blocks?: unknown }).blocks;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is BlockRow =>
      !!x &&
      typeof x === "object" &&
      typeof (x as BlockRow).key === "string" &&
      typeof (x as BlockRow).value === "string",
  );
}

export type HomepageTextMap = Record<HomepageTextBlockKey, string>;

export async function fetchHomepageTextBlockMap(): Promise<HomepageTextMap> {
  const base = { ...HOMEPAGE_TEXT_FALLBACKS } as unknown as HomepageTextMap;
  const url = `${getPublicApiBaseUrl()}/homepage/text-blocks/`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) {
      console.error("[fetchHomepageTextBlockMap] HTTP", res.status, url);
      return base;
    }
    const data = await res.json();
    for (const row of normalizeBlocksPayload(data)) {
      if (row.key in HOMEPAGE_TEXT_FALLBACKS) {
        base[row.key as HomepageTextBlockKey] = row.value;
      }
    }
    return base;
  } catch (e) {
    console.error("[fetchHomepageTextBlockMap]", e);
    return base;
  }
}
