# Generated manually for Stage 6 — per-realtor CRM capability flags.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_user_avatar_crm_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="perm_change_status",
            field=models.BooleanField(
                default=False,
                verbose_name="CRM: менять статус лидов",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="perm_create_property",
            field=models.BooleanField(
                default=False,
                verbose_name="CRM: создавать объекты",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="perm_delete_clients",
            field=models.BooleanField(
                default=False,
                verbose_name="CRM: удалять клиентов (лиды)",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="perm_delete_property",
            field=models.BooleanField(
                default=False,
                verbose_name="CRM: архивировать объекты",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="perm_edit_property",
            field=models.BooleanField(
                default=False,
                verbose_name="CRM: редактировать объекты",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="perm_view_clients",
            field=models.BooleanField(
                default=False,
                verbose_name="CRM: просматривать клиентов (лиды)",
            ),
        ),
    ]
