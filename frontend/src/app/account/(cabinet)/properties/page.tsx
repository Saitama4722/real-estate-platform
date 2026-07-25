import Link from "next/link";
import { PageHeading } from "@/components/layout/page-heading";
import { CrmPropertyTable } from "@/components/crm/CrmPropertyTable";
import { PhotoUploadWarningBanner } from "@/components/crm/PhotoUploadWarningBanner";

function firstParam(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

interface AccountPropertiesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountPropertiesPage({
  searchParams,
}: AccountPropertiesPageProps) {
  const params = await searchParams;
  const showPhotoWarn = firstParam(params.photoWarn) === "1";
  const failed = parseInt(firstParam(params.failed), 10);
  const total = parseInt(firstParam(params.total), 10);
  const photoWarn =
    showPhotoWarn && Number.isFinite(failed) && failed > 0 && Number.isFinite(total) && total > 0;

  return (
    <>
      <PageHeading title="Объекты" subtitle="Управление объектами недвижимости" />
      {photoWarn && <PhotoUploadWarningBanner failed={failed} total={total} />}
      <div className="mt-6 flex justify-end">
        <Link
          href="/account/properties/new"
          className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
        >
          Добавить объект
        </Link>
      </div>
      <CrmPropertyTable />
    </>
  );
}
