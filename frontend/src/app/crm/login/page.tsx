import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/layout/page-heading";
import { CrmLoginForm } from "@/components/crm/CrmLoginForm";

export default function CrmLoginPage() {
  return (
    <Container className="py-10">
      <PageHeading title="Вход в CRM" subtitle="Email и пароль учётной записи агента или администратора" />
      <CrmLoginForm />
    </Container>
  );
}
