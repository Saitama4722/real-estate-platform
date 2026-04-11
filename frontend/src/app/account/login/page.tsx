import { PageHeading } from "@/components/layout/page-heading";
import { CrmLoginForm } from "@/components/crm/CrmLoginForm";

export default function AccountLoginPage() {
  return (
    <>
      <PageHeading
        title="Вход в личный кабинет"
        subtitle="Email и пароль учётной записи сотрудника"
      />
      <CrmLoginForm />
    </>
  );
}
