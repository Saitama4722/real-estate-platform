import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/layout/page-heading";

export default function CrmArticlesPage() {
  return (
    <Container className="py-10">
      <PageHeading title="Статьи" />
      <p className="mt-6 max-w-2xl text-sm text-gray-600">
        Отдельного CRM REST API для статей в проекте нет: публикация и правки выполняются через Django Admin.
        Публичный сайт читает материалы с «GET /api/articles/».
      </p>
    </Container>
  );
}
