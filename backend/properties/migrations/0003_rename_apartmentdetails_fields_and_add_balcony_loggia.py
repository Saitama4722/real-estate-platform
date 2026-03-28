# Generated manually for Stage 6.1 — renames DB columns and adds balcony/loggia flags.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("properties", "0002_apartmentdetails"),
    ]

    operations = [
        migrations.RenameField(
            model_name="apartmentdetails",
            old_name="total_area",
            new_name="area_total",
        ),
        migrations.RenameField(
            model_name="apartmentdetails",
            old_name="living_area",
            new_name="area_living",
        ),
        migrations.RenameField(
            model_name="apartmentdetails",
            old_name="kitchen_area",
            new_name="area_kitchen",
        ),
        migrations.RenameField(
            model_name="apartmentdetails",
            old_name="total_floors",
            new_name="floors_total",
        ),
        migrations.AddField(
            model_name="apartmentdetails",
            name="has_balcony",
            field=models.BooleanField(default=False, verbose_name="Есть балкон"),
        ),
        migrations.AddField(
            model_name="apartmentdetails",
            name="has_loggia",
            field=models.BooleanField(default=False, verbose_name="Есть лоджия"),
        ),
    ]
