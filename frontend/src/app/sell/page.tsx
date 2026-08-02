import type { Metadata } from "next";
import { Home } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Icon } from "@/components/ui/icon";
import { SellPropertyForm } from "@/components/sell/SellPropertyForm";
import { fetchSellCities } from "@/lib/saleRequest";

export const metadata: Metadata = {
  title: "Продать недвижимость — Centreal",
  description:
    "Продайте квартиру, дом или участок с агентством Centreal. Оставьте заявку — риэлтор оценит объект и поможет с продажей. Ваш телефон видят только сотрудники агентства.",
};

export default async function SellPage() {
  const cities = await fetchSellCities();

  return (
    <Container className="py-10">
      {/* A single-task page: the form is the page, so it is centred on a
          760px measure rather than filling the 1152px shell. */}
      <div className="mx-auto max-w-[760px]">
        <div className="text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-tint px-3.5 py-1.5 text-[13px] font-semibold text-brand">
            <Icon icon={Home} className="size-[15px]" />
            Заявка на продажу
          </span>
          <h1 className="text-h1 text-fg">Продать недвижимость</h1>
          <p className="mx-auto mt-2.5 max-w-[520px] text-body text-fg-muted text-pretty">
            Оставьте заявку — наш риэлтор свяжется с вами, оценит объект и
            поможет выгодно его продать
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-[20px] bg-surface-raised shadow-md">
          <SellPropertyForm cities={cities} />
        </div>

        <p className="mx-auto mt-5 max-w-[600px] text-center text-xs leading-relaxed text-fg-muted text-pretty">
          Отправляя заявку, вы соглашаетесь на обработку контактных данных для
          связи по вопросу продажи вашей недвижимости. Заявка не публикуется на
          сайте — она поступает только сотрудникам агентства.
        </p>
      </div>
    </Container>
  );
}
