"""
Step 2 of 3: move each guide's `body` into `intro`, verbatim.

The 24 existing guides have ZERO headings (the parse audit found none), so
there is nothing to split — the whole body is the intro, and the other four
fields stay empty. «Что за район» renders WITHOUT a heading, so the page is
byte-identical to before: same prose, no headings, no TOC, no takeaway. The
per-section redistribution happens later, when the superadmin edits each guide.

Reversible: copy intro back to body.
"""
from django.db import migrations


def forwards(apps, schema_editor):
    DistrictGuide = apps.get_model("locations", "DistrictGuide")
    for guide in DistrictGuide.objects.all():
        guide.intro = guide.body or ""
        guide.save(update_fields=["intro"])


def backwards(apps, schema_editor):
    DistrictGuide = apps.get_model("locations", "DistrictGuide")
    for guide in DistrictGuide.objects.all():
        # Reassemble the parts in reading order (idempotent for the common case
        # where only intro is populated).
        parts = [
            guide.intro, guide.housing, guide.infrastructure,
            guide.audience, guide.conclusion,
        ]
        guide.body = "\n\n".join(p for p in parts if p)
        guide.save(update_fields=["body"])


class Migration(migrations.Migration):

    dependencies = [
        ("locations", "0007_districtguide_sections"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
