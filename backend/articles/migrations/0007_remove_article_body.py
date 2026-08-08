from django.db import migrations


class Migration(migrations.Migration):
    """Step 3 of 3: drop `body`. Structured fields are the single source now."""

    dependencies = [
        ("articles", "0006_split_body_into_sections"),
    ]

    operations = [
        migrations.RemoveField(model_name="article", name="body"),
    ]
