"""
Split the 22 pilot district guides from one block of prose into the six section
fields. `krasnodar-obzor` and `gelendzhik-obzor` are deliberately excluded — see
locations/guide_pilot_sections.py for why.

⚠ THE MAP IS INLINED ON PURPOSE. `locations/guide_pilot_sections.py` holds the
identical data for the seed command, but a migration is a historical record and
must never import a live app module: `articles.0003` once imported a constant
that a later refactor deleted, which broke the whole migration graph on import.

Reversible in both directions. Forward splits `intro` on blank lines; backward
rejoins the six fields in reading order, which reproduces the original text
because every paragraph is claimed exactly once and the fields' reading order
matches the paragraphs' original order.

SAFETY: a guide is skipped, not guessed at, when it does not look like the
untouched pilot text — if any other section field is already filled, or if the
paragraph count does not match the map. A hand-edited guide is therefore left
exactly as it is.
"""
from django.db import migrations

SECTION_ORDER = (
    "intro", "housing", "infrastructure", "audience", "caveats", "conclusion",
)

PILOT_SECTION_MAP = {
    "cmr-centralnyy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "fmr-festivalnyy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "yumr-yubileynyy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "gmr-gidrostroiteley-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "kmr-komsomolskiy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "smr-slavyanskiy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "zip-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "pmr-pashkovskiy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "caveats": [3, 4, 5], "conclusion": [6]},
    "hbk-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "infrastructure": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "shi-selhozinstitut-krasnodar": {
        "intro": [1], "housing": [2], "infrastructure": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "enka-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "infrastructure": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "dubinka-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2, 3], "caveats": [4, 5], "conclusion": [6]},
    "muzykalnyy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "infrastructure": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "gelendzhik-centr": {
        "intro": [1], "housing": [2], "caveats": [3, 4], "conclusion": [5]},
    "gelendzhik-tolstyy-mys": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "gelendzhik-tonkiy-mys": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "gelendzhik-pyatyy-mikrorayon": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "kabardinka-gelendzhik": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "divnomorskoe-gelendzhik": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "arhipo-osipovka-gelendzhik": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "dzhankhot-gelendzhik": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
    "krinitsa-gelendzhik": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6]},
}

OTHER_FIELDS = ("housing", "infrastructure", "audience", "caveats", "conclusion")


def split_sections(apps, schema_editor):
    DistrictGuide = apps.get_model("locations", "DistrictGuide")
    for guide in DistrictGuide.objects.filter(slug__in=PILOT_SECTION_MAP):
        if any(getattr(guide, name).strip() for name in OTHER_FIELDS):
            continue  # already structured or hand-edited — leave alone
        spec = PILOT_SECTION_MAP[guide.slug]
        paragraphs = guide.intro.split("\n\n")
        claimed = sorted(n for numbers in spec.values() for n in numbers)
        if claimed != list(range(1, len(paragraphs) + 1)):
            continue  # text no longer matches the pilot shape — leave alone
        for field in SECTION_ORDER:
            setattr(
                guide,
                field,
                "\n\n".join(paragraphs[n - 1] for n in sorted(spec.get(field, []))),
            )
        guide.save(update_fields=list(SECTION_ORDER))


def rejoin_sections(apps, schema_editor):
    DistrictGuide = apps.get_model("locations", "DistrictGuide")
    for guide in DistrictGuide.objects.filter(slug__in=PILOT_SECTION_MAP):
        parts = [
            getattr(guide, name) for name in SECTION_ORDER
            if getattr(guide, name).strip()
        ]
        if len(parts) < 2:
            continue  # never split, or already rejoined
        guide.intro = "\n\n".join(parts)
        for name in OTHER_FIELDS:
            setattr(guide, name, "")
        guide.save(update_fields=list(SECTION_ORDER))


class Migration(migrations.Migration):

    dependencies = [
        ("locations", "0010_districtguide_caveats"),
    ]

    operations = [
        migrations.RunPython(split_sections, rejoin_sections),
    ]
