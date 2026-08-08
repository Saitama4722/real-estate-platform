"""
How each PILOT district guide's single block of prose divides into the six
section fields.

The 24 pilot guides were written before the sections existed, so every one of
them arrived as one continuous text in `intro`. They share one shape, in this
order: what the area is / housing / who it suits / a lead-in line + a list of
caveats / a closing takeaway. This module records, per guide, which PARAGRAPH
(1-based, splitting on blank lines) belongs to which field.

⚠ THIS IS A ONE-TIME ARTEFACT for the pilot batch, not a general mechanism.
Guides written from now on are authored directly in the six admin fields; there
is no parser and no convention to remember. The map lives here rather than in
the migration so the SEED COMMAND can apply the identical split — otherwise
re-running the seed would overwrite `intro` with the whole text again while the
other fields kept their content, and every guide would render twice.
`locations/migrations/0011_split_pilot_guide_sections.py` deliberately INLINES
its own copy: a migration is a historical record and must never import a live
app module (that broke the migration graph once already — see CLAUDE.md).

Two guides are deliberately ABSENT from the map and stay unsplit:
`krasnodar-obzor` and `gelendzhik-obzor`. They are section indexes rather than
area descriptions — they have no housing paragraph, they enumerate other guides,
and both end on a navigational «read these next» line that would read oddly as a
«Главное» takeaway card. Left whole, they keep rendering single-column with no
table of contents, which suits them.
"""

#: guide slug -> {field: [1-based paragraph numbers]}. Fields absent from a
#: guide's entry stay empty, which renders no heading at all.
PILOT_SECTION_MAP = {
    # ---- Краснодар ------------------------------------------------------
    # The standard shape: 1 intro / 2 housing / 3 audience / 4+5 caveats / 6 вывод.
    "cmr-centralnyy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "fmr-festivalnyy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "yumr-yubileynyy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "gmr-gidrostroiteley-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "kmr-komsomolskiy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "smr-slavyanskiy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "zip-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    # P3 «Район большой, и внутри него условия ощутимо разнятся» is a caveat
    # about choosing by sub-area, not a description of who the district suits.
    "pmr-pashkovskiy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "caveats": [3, 4, 5], "conclusion": [6],
    },
    # P3 lists shops, schools, kindergartens and transport — infrastructure.
    "hbk-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "infrastructure": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    # P3 is about the university's green territories — environment, not audience.
    "shi-selhozinstitut-krasnodar": {
        "intro": [1], "housing": [2], "infrastructure": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    # P3 is infrastructure lagging behind fast construction.
    "enka-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "infrastructure": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    # P3 continues P2: the age and wear of the building stock.
    "dubinka-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2, 3], "caveats": [4, 5], "conclusion": [6],
    },
    # P3 is load on schools, roads and parking in a dense new district.
    "muzykalnyy-mikrorayon-krasnodar": {
        "intro": [1], "housing": [2], "infrastructure": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    # ---- Геленджик ------------------------------------------------------
    # Five paragraphs, and the audience block comes LAST with no closing
    # takeaway. Moved into «Вывод» so the guide gets a «Главное» card like the
    # rest; «Кому подойдёт» stays empty (owner's call, 2026-08-08).
    "gelendzhik-centr": {
        "intro": [1], "housing": [2], "caveats": [3, 4], "conclusion": [5],
    },
    "gelendzhik-tolstyy-mys": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "gelendzhik-tonkiy-mys": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "gelendzhik-pyatyy-mikrorayon": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "kabardinka-gelendzhik": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "divnomorskoe-gelendzhik": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "arhipo-osipovka-gelendzhik": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "dzhankhot-gelendzhik": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
    "krinitsa-gelendzhik": {
        "intro": [1], "housing": [2], "audience": [3],
        "caveats": [4, 5], "conclusion": [6],
    },
}

#: Reading order, mirroring DistrictGuide.SECTION_FIELDS.
SECTION_ORDER = (
    "intro", "housing", "infrastructure", "audience", "caveats", "conclusion",
)


def split_pilot_text(text, spec):
    """
    Divide one guide's text into `{field: text}` per `spec`.

    Paragraphs are joined back with the same blank-line separator they were
    split on, and every paragraph must be claimed exactly once — so
    reassembling the fields in `SECTION_ORDER` reproduces the input verbatim.
    Raises ValueError rather than guessing if the text does not have the
    expected number of paragraphs (a hand-edited guide must not be mangled).
    """
    paragraphs = text.split("\n\n")
    expected = sorted(n for numbers in spec.values() for n in numbers)
    if expected != list(range(1, len(paragraphs) + 1)):
        raise ValueError(
            "paragraph mismatch: text has %d, map claims %r"
            % (len(paragraphs), expected)
        )
    return {
        field: "\n\n".join(paragraphs[n - 1] for n in sorted(spec[field]))
        for field in SECTION_ORDER
        if spec.get(field)
    }
