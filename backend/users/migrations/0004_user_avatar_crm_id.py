# Generated manually for Stage 5 — realtor CRM identifiers and avatars.

from django.db import migrations, models


def backfill_crm_ids(apps, schema_editor):
    User = apps.get_model("users", "User")
    for idx, user in enumerate(User.objects.order_by("pk"), start=1):
        User.objects.filter(pk=user.pk).update(crm_id=f"RID{idx:06d}")


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_alter_realtorprofile_options_alter_user_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="users/avatars/",
                verbose_name="Аватар",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="crm_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=10,
                null=True,
                unique=True,
                verbose_name="CRM ID",
            ),
        ),
        migrations.RunPython(backfill_crm_ids, noop_reverse),
        migrations.AlterField(
            model_name="user",
            name="crm_id",
            field=models.CharField(
                blank=False,
                db_index=True,
                max_length=10,
                unique=True,
                verbose_name="CRM ID",
            ),
        ),
    ]
