import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("leads", "0005_alter_lead_created_at_alter_lead_updated_at_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="LeadPhoneRevealLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "ip_address",
                    models.GenericIPAddressField(
                        blank=True,
                        null=True,
                        verbose_name="IP-адрес",
                    ),
                ),
                (
                    "user_agent",
                    models.TextField(blank=True, verbose_name="User-Agent (браузер)"),
                ),
                (
                    "revealed_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        db_index=True,
                        verbose_name="Время раскрытия",
                    ),
                ),
                (
                    "lead",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="phone_reveal_logs",
                        to="leads.lead",
                        verbose_name="Лид",
                    ),
                ),
                (
                    "revealed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="lead_phone_reveal_logs",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Сотрудник",
                    ),
                ),
            ],
            options={
                "verbose_name": "Лог раскрытия телефона (лид)",
                "verbose_name_plural": "Логи раскрытия телефона (лиды)",
                "ordering": ["-revealed_at"],
            },
        ),
    ]
