"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { CrmPropertyFullForm } from "@/components/crm/CrmPropertyFullForm";
import { getCrmAccessToken } from "@/lib/crmAuth";

export default function AccountPropertyDetailPage() {
  const params = useParams();
  const idParam = params?.id;
  const id = typeof idParam === "string" ? idParam : Array.isArray(idParam) ? idParam[0] : "";

  if (!getCrmAccessToken()) {
    return (
      <>
        <PageHeading title="Объект" subtitle="Просмотр и редактирование" />
        <p className="mt-4 text-sm text-gray-600">
          <Link href="/account/login" className="text-blue-600 underline">
            Войдите
          </Link>
          , чтобы открыть объект.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeading title="Объект" subtitle="Редактирование в CRM" />
      <div className="mt-2 text-sm text-gray-600">
        <Link href="/account/properties" className="text-blue-600 hover:underline">
          ← К списку объектов
        </Link>
      </div>
      <div className="mt-6">
        <CrmPropertyFullForm mode="edit" propertyId={id} />
      </div>
    </>
  );
}
