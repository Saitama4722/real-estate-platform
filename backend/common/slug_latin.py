"""
Deterministic transliteration of Russian text to URL-safe Latin slug segments.
"""

from __future__ import annotations

import re

from django.utils.text import slugify

# Single-letter mapping (йо → io via sequential replacement)
_CYRILLIC_LATIN = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "e",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "h",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "sch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}


def transliterate_ru_to_latin(text: str) -> str:
    if not text:
        return ""
    out: list[str] = []
    for ch in text.lower():
        if ch in _CYRILLIC_LATIN:
            out.append(_CYRILLIC_LATIN[ch])
        else:
            out.append(ch)
    return "".join(out)


def slugify_latin(text: str) -> str:
    """Lowercase ASCII slug; empty if nothing usable remains."""
    if not text:
        return ""
    step = transliterate_ru_to_latin(text)
    s = slugify(step, allow_unicode=False)
    return (s or "").strip("-")


def join_slug_parts(*parts: str, max_length: int = 320) -> str:
    cleaned = []
    for p in parts:
        p = (p or "").strip().strip("-")
        if p:
            cleaned.append(p)
    base = "-".join(cleaned)
    base = re.sub(r"-{2,}", "-", base).strip("-")
    if len(base) <= max_length:
        return base
    return base[:max_length].rstrip("-")
