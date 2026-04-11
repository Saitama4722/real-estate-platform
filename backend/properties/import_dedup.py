"""
Conservative exact-match duplicate detection for import (Stage 14.6).

Does not replace ``duplicate_detection.run_duplicate_check`` (scoring for CRM UI).
Import uses a narrow rule: same type, city, normalized street + house number, price.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from properties.choices import PropertyStatus, PropertyType
from properties.models import Property

_PT_VALUES = {c.value for c in PropertyType}


def _norm_addr(s: str | None) -> str:
    return (s or "").strip().lower()


def _same_price(a, b) -> bool:
    try:
        da = a if isinstance(a, Decimal) else Decimal(str(a))
        db = b if isinstance(b, Decimal) else Decimal(str(b))
    except (InvalidOperation, TypeError, ValueError):
        return False
    return da == db


def find_exact_import_duplicate(
    data: dict,
    base_qs,
) -> Property | None:
    """
    Return an existing property that is an obvious duplicate for import, or None.

    Requires: property_type, city (int pk), street, house_number, price.
    Excludes archived listings.
    """
    ptype = data.get("property_type")
    if not ptype or ptype not in _PT_VALUES:
        return None

    city_id = data.get("city")
    if city_id is None:
        return None

    street = _norm_addr(data.get("street"))
    house = _norm_addr(data.get("house_number"))
    if not street or not house:
        return None

    price = data.get("price")
    if price is None:
        return None

    qs = (
        base_qs.exclude(status=PropertyStatus.ARCHIVED)
        .filter(
            property_type=ptype,
            city_id=int(city_id),
        )
    )

    for cand in qs.iterator(chunk_size=200):
        if _norm_addr(cand.street) != street:
            continue
        if _norm_addr(cand.house_number) != house:
            continue
        if not _same_price(price, cand.price):
            continue
        return cand

    return None
