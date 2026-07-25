import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/layout/page-heading";
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
      <PageHeading
        title="Продать недвижимость"
        subtitle="Оставьте заявку — наш риэлтор свяжется с вами, оценит объект и поможет выгодно его продать"
      />

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
        <SellPropertyForm cities={cities} />
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-gray-500">
        Отправляя заявку, вы соглашаетесь на обработку контактных данных для связи
        по вопросу продажи вашей недвижимости. Заявка не публикуется на сайте — она
        поступает только сотрудникам агентства.
      </p>
    </Container>
  );
}
