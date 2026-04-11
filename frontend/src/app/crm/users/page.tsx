import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/layout/page-heading";

export default function CrmUsersPage() {
  return (
    <Container className="py-10">
      <PageHeading title="Пользователи" />
      <p className="mt-6 max-w-2xl text-sm text-gray-600">
        Списка пользователей для CRM-интерфейса в API не предусмотрено. Учётные записи создаются и
        редактируются через Django Admin; текущий пользователь доступен после входа на «GET /api/auth/me/».
      </p>
    </Container>
  );
}
