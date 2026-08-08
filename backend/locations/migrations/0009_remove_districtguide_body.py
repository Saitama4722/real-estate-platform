from django.db import migrations


class Migration(migrations.Migration):
    """Step 3 of 3: drop `body`; the section fields are the source now."""

    dependencies = [
        ("locations", "0008_copy_guide_body_to_intro"),
    ]

    operations = [
        migrations.RemoveField(model_name="districtguide", name="body"),
    ]
