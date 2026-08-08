"""
Splitting plain prose into the structured section fields.

Content is AUTHORED as structured fields (that is the whole point of the
2026-08-08 change: an author types into a box labelled «Застройка и жильё» and
gets that section, with no markup to remember). This helper exists only for the
two places that still start from one plain-text blob:

* the seed management commands, whose article texts are long literals; and
* migration `articles.0006`, which carries its OWN FROZEN COPY of this logic —
  a migration must not import app code that can change under it. If you change
  the heading rule here, the migration stays as it is: it describes a split that
  already happened.

The heading rule mirrors the frontend parser as it stood before the change: a
paragraph is a heading iff it is a single short line that does not end in
punctuation. That is a HEURISTIC, which is exactly why authoring no longer
relies on it.
"""
import re

_TERMINAL = re.compile(r'[.,:;!?…]["»)]?$')
_HEAD_START = re.compile(r"^[А-ЯЁA-Z0-9«\"]")
_LIST_MARKER = ("- ", "— ", "– ", "• ")

#: Trailing section names that mean "this is the takeaway", not a section.
TAKEAWAY_TITLES = {"вывод", "совет", "итог", "главное"}

DEFAULT_CONCLUSION_TITLE = "Вывод"


def is_heading(paragraph: str) -> bool:
    lines = [line for line in paragraph.split("\n") if line.strip()]
    if len(lines) != 1:
        return False
    line = lines[0].strip()
    if line.startswith(_LIST_MARKER):
        return False
    return (
        2 <= len(line) <= 90
        and bool(_HEAD_START.match(line))
        and not _TERMINAL.search(line)
    )


def split_plain_body(body: str):
    """
    -> (intro, [(heading, text), ...], conclusion_title, conclusion)

    Text between headings is preserved verbatim (paragraphs rejoined with a
    blank line), so list markers, «Важно:» callouts and quotes round-trip.
    """
    paragraphs = [
        p for p in re.split(r"\n{2,}", (body or "").replace("\r\n", "\n")) if p.strip()
    ]

    lead_parts: list[str] = []
    sections: list[list] = []  # [heading, [paragraph, ...]]
    for paragraph in paragraphs:
        if is_heading(paragraph):
            sections.append([paragraph.strip(), []])
        elif sections:
            sections[-1][1].append(paragraph)
        else:
            lead_parts.append(paragraph)

    conclusion_title, conclusion = DEFAULT_CONCLUSION_TITLE, ""
    if sections and sections[-1][0].lower() in TAKEAWAY_TITLES:
        conclusion_title, parts = sections.pop()
        conclusion = "\n\n".join(parts)

    return (
        "\n\n".join(lead_parts),
        [(heading, "\n\n".join(parts)) for heading, parts in sections],
        conclusion_title,
        conclusion,
    )


def apply_plain_body(article, body: str) -> None:
    """
    Write a plain-text blob onto an existing Article as structured fields,
    REPLACING its sections. Used by the seed commands, which still carry their
    texts as literals; ordinary editing goes through the admin form instead.
    """
    from articles.models import ArticleSection

    intro, sections, conclusion_title, conclusion = split_plain_body(body)
    article.intro = intro
    article.conclusion_title = conclusion_title
    article.conclusion = conclusion
    article.save(update_fields=["intro", "conclusion_title", "conclusion"])

    ArticleSection.objects.filter(article=article).delete()
    ArticleSection.objects.bulk_create(
        [
            ArticleSection(article=article, heading=heading, text=text, order=index + 1)
            for index, (heading, text) in enumerate(sections)
        ]
    )
