"""
Soft duplicate detection for CRM property creation.

Level 1 (hard unique check):
    Not applicable — the Property model has no unique external identifier
    (no external_id, source_id, cadastral_number, etc.).
    Hard-block is therefore skipped entirely.

Level 2 (soft duplicate detection):
    Score-based similarity check. Each candidate gets a score; candidates
    scoring >= THRESHOLD_SUSPICIOUS are returned as warnings to the CRM user.
    Creation is never hard-blocked — the user always has the option to proceed.

Scoring weights (base Property fields):
    same property_type                   +20
    same city                            +10
    same district                        +10
    same residential_complex (ЖК)        +15
    same street + house_number (building)+20
    same street only                     +10
    price within ±10%                    +10

Type-specific weights (from detail models, if present):
    Apartment:
        same rooms                       +10
        area_total within ±3%            +15
        same floor                       +10
        same floors_total                + 5
    House:
        house_area within ±3%            +15
        land_area within ±5%             +10
    Land:
        land_area within ±5%             +15
    Commercial:
        area_total within ±3%            +15
        same floor                       +10
        same commercial_type             + 5

Thresholds:
    >= 80  → likely duplicate
    60–79  → suspicious (strong similarity)
    < 60   → not flagged
"""

from properties.choices import PropertyStatus, PropertyType
from properties.models import Property

THRESHOLD_LIKELY = 80
THRESHOLD_SUSPICIOUS = 60


def _pct_diff(a, b) -> float | None:
    """Absolute percentage difference of a relative to b. Returns None if inputs are invalid."""
    try:
        fa, fb = float(a), float(b)
    except (TypeError, ValueError):
        return None
    if fb == 0:
        return None
    return abs(fa - fb) / fb


def _score_base(candidate: Property, data: dict) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    if data.get("property_type") and candidate.property_type == data["property_type"]:
        score += 20
        reasons.append("совпадает тип недвижимости")

    city_id = data.get("city")
    if city_id is not None and candidate.city_id == city_id:
        score += 10
        reasons.append("совпадает город")

    district_id = data.get("district")
    if district_id is not None and candidate.district_id == district_id:
        score += 10
        reasons.append("совпадает район")

    rc_id = data.get("residential_complex")
    if rc_id is not None and candidate.residential_complex_id == rc_id:
        score += 15
        reasons.append("совпадает ЖК")

    street = (data.get("street") or "").strip().lower()
    house_number = (data.get("house_number") or "").strip().lower()
    cand_street = (candidate.street or "").strip().lower()
    cand_house = (candidate.house_number or "").strip().lower()

    if street and house_number and cand_street and cand_house:
        if cand_street == street and cand_house == house_number:
            score += 20
            reasons.append("совпадает адрес (улица и номер дома)")
    elif street and cand_street and cand_street == street:
        score += 10
        reasons.append("совпадает улица")

    price = data.get("price")
    if price is not None and candidate.price is not None:
        diff = _pct_diff(price, candidate.price)
        if diff is not None and diff <= 0.10:
            score += 10
            reasons.append("близкая цена (±10%)")

    return score, reasons


def _score_apartment(candidate: Property, data: dict) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    try:
        d = candidate.apartment_details
    except Exception:
        return 0, []

    rooms = data.get("rooms")
    if rooms is not None and d.rooms is not None and int(rooms) == d.rooms:
        score += 10
        reasons.append("совпадает количество комнат")

    area = data.get("area_total")
    if area is not None and d.area_total is not None:
        diff = _pct_diff(area, d.area_total)
        if diff is not None and diff <= 0.03:
            score += 15
            reasons.append("близкая общая площадь (±3%)")

    floor = data.get("floor")
    if floor is not None and d.floor is not None and int(floor) == d.floor:
        score += 10
        reasons.append("совпадает этаж")

    floors_total = data.get("floors_total")
    if floors_total is not None and d.floors_total is not None and int(floors_total) == d.floors_total:
        score += 5
        reasons.append("совпадает этажность дома")

    return score, reasons


def _score_house(candidate: Property, data: dict) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    try:
        d = candidate.house_details
    except Exception:
        return 0, []

    house_area = data.get("house_area")
    if house_area is not None and d.house_area is not None:
        diff = _pct_diff(house_area, d.house_area)
        if diff is not None and diff <= 0.03:
            score += 15
            reasons.append("близкая площадь дома (±3%)")

    land_area = data.get("land_area")
    if land_area is not None and d.land_area is not None:
        diff = _pct_diff(land_area, d.land_area)
        if diff is not None and diff <= 0.05:
            score += 10
            reasons.append("близкая площадь участка (±5%)")

    return score, reasons


def _score_land(candidate: Property, data: dict) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    try:
        d = candidate.land_plot_details
    except Exception:
        return 0, []

    land_area = data.get("land_area")
    if land_area is not None and d.land_area is not None:
        diff = _pct_diff(land_area, d.land_area)
        if diff is not None and diff <= 0.05:
            score += 15
            reasons.append("близкая площадь участка (±5%)")

    return score, reasons


def _score_commercial(candidate: Property, data: dict) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    try:
        d = candidate.commercial_details
    except Exception:
        return 0, []

    area = data.get("area_total")
    if area is not None and d.area_total is not None:
        diff = _pct_diff(area, d.area_total)
        if diff is not None and diff <= 0.03:
            score += 15
            reasons.append("близкая общая площадь (±3%)")

    floor = data.get("floor")
    if floor is not None and d.floor is not None and int(floor) == d.floor:
        score += 10
        reasons.append("совпадает этаж")

    commercial_type = data.get("commercial_type")
    if commercial_type and d.commercial_type and d.commercial_type == commercial_type:
        score += 5
        reasons.append("совпадает тип коммерции")

    return score, reasons


_TYPE_SCORERS = {
    PropertyType.APARTMENT: _score_apartment,
    PropertyType.HOUSE: _score_house,
    PropertyType.LAND: _score_land,
    PropertyType.COMMERCIAL: _score_commercial,
}


def score_duplicate(candidate: Property, data: dict) -> tuple[int, list[str]]:
    """
    Calculate similarity score between a candidate Property and a new-property data dict.
    Returns (total_score, reasons_list).
    """
    base_score, base_reasons = _score_base(candidate, data)
    property_type = data.get("property_type")
    type_scorer = _TYPE_SCORERS.get(property_type)
    if type_scorer:
        type_score, type_reasons = type_scorer(candidate, data)
    else:
        type_score, type_reasons = 0, []
    return base_score + type_score, base_reasons + type_reasons


def find_duplicate_candidates(data: dict, base_qs=None):
    """
    Narrow the candidate pool by property_type + city/district to limit the query.
    Excludes archived properties.
    Returns an empty queryset if no city/district is provided (no meaningful scope).
    """
    if base_qs is None:
        base_qs = Property.objects.all()

    qs = base_qs.exclude(status=PropertyStatus.ARCHIVED).select_related(
        "city",
        "district",
        "residential_complex",
        "apartment_details",
        "house_details",
        "land_plot_details",
        "commercial_details",
    )

    property_type = data.get("property_type")
    if property_type:
        qs = qs.filter(property_type=property_type)

    city_id = data.get("city")
    district_id = data.get("district")

    if city_id and district_id:
        qs = qs.filter(city_id=city_id, district_id=district_id)
    elif city_id:
        qs = qs.filter(city_id=city_id)
    elif district_id:
        qs = qs.filter(district_id=district_id)
    else:
        return Property.objects.none()

    return qs


def _location_label(candidate: Property) -> str:
    parts = []
    if candidate.city_id and candidate.city:
        name = getattr(candidate.city, "name", "") or ""
        if name:
            parts.append(name)
    if candidate.district_id and candidate.district:
        name = getattr(candidate.district, "name", "") or ""
        if name:
            parts.append(name)
    return ", ".join(parts)


def run_duplicate_check(data: dict, base_qs=None) -> dict:
    """
    Run the full duplicate check for a new-property payload dict.

    Args:
        data: validated dict from DuplicateCheckSerializer.
        base_qs: optional base queryset (e.g. scoped to current CRM user's agency).

    Returns:
        {
            "has_warnings": bool,
            "likely_duplicates": [...],   # score >= THRESHOLD_LIKELY (80)
            "suspicious": [...],          # score in [THRESHOLD_SUSPICIOUS, THRESHOLD_LIKELY)
        }

    Each list item:
        {"id": int, "title": str, "price": str, "location": str,
         "status": str, "score": int, "reasons": [str]}
    """
    candidates = find_duplicate_candidates(data, base_qs)
    likely: list[dict] = []
    suspicious: list[dict] = []

    for candidate in candidates:
        total_score, reasons = score_duplicate(candidate, data)
        if total_score < THRESHOLD_SUSPICIOUS:
            continue
        entry = {
            "id": candidate.pk,
            "title": candidate.title_generated or str(candidate),
            "price": str(candidate.price),
            "location": candidate.public_address_text or _location_label(candidate),
            "status": candidate.status,
            "score": total_score,
            "reasons": reasons,
        }
        if total_score >= THRESHOLD_LIKELY:
            likely.append(entry)
        else:
            suspicious.append(entry)

    likely.sort(key=lambda x: -x["score"])
    suspicious.sort(key=lambda x: -x["score"])

    return {
        "has_warnings": bool(likely or suspicious),
        "likely_duplicates": likely,
        "suspicious": suspicious,
    }
