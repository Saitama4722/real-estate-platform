"""
Step 2 of 3: split each article's plain-text `body` into intro / sections /
conclusion.

The split replicates the frontend parser's HEADING rule exactly (the same
Python replica already used by the parse-audit scripts, which reported all 15
articles splitting cleanly with zero warnings):

  a paragraph is a heading iff it is a SINGLE line, 2–90 chars, starts with a
  capital/digit/«, and does not END with punctuation. («Новостройка: на что
  обратить внимание» is a heading — the colon is inside, not terminal.)

Everything between headings is copied VERBATIM (paragraphs joined back with
blank lines), so list markers, «Важно:» and quotes round-trip untouched. The
final heading in {Вывод, Совет, Итог, Главное} becomes the conclusion, and its
exact wording is preserved in conclusion_title (one real article says «Совет»).

Reversible: the reverse op reassembles `body` from the parts.
"""
import re

from django.db import migrations

TERMINAL = re.compile(r'[.,:;!?…]["»)]?$')
HEAD_START = re.compile(r"^[А-ЯЁA-Z0-9«\"]")
TAKEAWAY = {"вывод", "совет", "итог", "главное"}


def _is_heading(paragraph: str) -> bool:
    lines = [l for l in paragraph.split("\n") if l.strip()]
    if len(lines) != 1:
        return False
    line = lines[0].strip()
    if line.startswith(("- ", "— ", "– ", "• ")):
        return False
    return 2 <= len(line) <= 90 and bool(HEAD_START.match(line)) and not TERMINAL.search(line)


def _split(body: str):
    paragraphs = [p for p in re.split(r"\n{2,}", body.replace("\r\n", "\n")) if p.strip()]
    lead_parts, sections = [], []  # sections: [heading, [paragraphs]]
    for p in paragraphs:
        if _is_heading(p):
            sections.append([p.strip(), []])
        elif sections:
            sections[-1][1].append(p)
        else:
            lead_parts.append(p)

    conclusion_title, conclusion = "Вывод", ""
    if sections and sections[-1][0].lower() in TAKEAWAY:
        conclusion_title, parts = sections.pop()
        conclusion = "\n\n".join(parts)

    return (
        "\n\n".join(lead_parts),
        [(h, "\n\n".join(parts)) for h, parts in sections],
        conclusion_title,
        conclusion,
    )


def forwards(apps, schema_editor):
    Article = apps.get_model("articles", "Article")
    ArticleSection = apps.get_model("articles", "ArticleSection")
    for article in Article.objects.all():
        intro, sections, conclusion_title, conclusion = _split(article.body or "")
        article.intro = intro
        article.conclusion_title = conclusion_title
        article.conclusion = conclusion
        article.save(update_fields=["intro", "conclusion_title", "conclusion"])
        ArticleSection.objects.filter(article=article).delete()
        ArticleSection.objects.bulk_create(
            ArticleSection(article=article, heading=h, text=t, order=i + 1)
            for i, (h, t) in enumerate(sections)
        )


def backwards(apps, schema_editor):
    Article = apps.get_model("articles", "Article")
    for article in Article.objects.prefetch_related("sections"):
        parts = [article.intro] if article.intro else []
        for s in article.sections.order_by("order", "id"):
            parts.append(s.heading)
            if s.text:
                parts.append(s.text)
        if article.conclusion:
            parts.append(article.conclusion_title)
            parts.append(article.conclusion)
        article.body = "\n\n".join(parts)
        article.save(update_fields=["body"])


class Migration(migrations.Migration):

    dependencies = [
        ("articles", "0005_structured_content"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
