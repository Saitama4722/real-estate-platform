import Link from "next/link";
import { PageHeading } from "@/components/layout/page-heading";
import { PropertyCreateForm } from "@/components/crm/PropertyCreateForm";

function firstParam(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

interface AccountPropertyCreatePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountPropertyCreatePage({
  searchParams,
}: AccountPropertyCreatePageProps) {
  const params = await searchParams;
  const fromSubmissionId = firstParam(params.fromSubmission) || undefined;

  return (
    <>
      <PageHeading
        title="Новый объект"
        subtitle={
          fromSubmissionId
            ? "Создание объекта из заявки на продажу — проверьте данные, задайте цену и телефон агентства"
            : "Создание объекта недвижимости"
        }
      />
      <div className="mt-2 text-sm text-gray-600">
        <Link href="/account/properties" className="text-blue-600 hover:underline">
          ← К списку объектов
        </Link>
      </div>
      {fromSubmissionId && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Объект создаётся из заявки собственника. Телефон собственника НЕ
          публикуется — на объявлении показывается телефон агентства (контакт
          риэлтора). Проверьте и при необходимости скорректируйте данные и цену.
        </div>
      )}
      <div className="mt-6">
        <PropertyCreateForm fromSubmissionId={fromSubmissionId} />
      </div>
    </>
  );
}
