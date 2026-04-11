"""
Shared property import pipeline (Stage 14.6): parse → map → validate → dedup → draft Property.
"""

from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction
from django.utils import timezone

from locations.choices import CommercialType
from properties.choices import CurrencyType, DealType, PropertyStatus, PropertyType
from properties.import_choices import (
    ImportDedupOutcome,
    ImportItemStatus,
    ImportJobStatus,
)
from properties.import_dedup import find_exact_import_duplicate
from properties.import_models import ImportItem, ImportJob
from properties.import_parsers import load_rows_for_format
from properties.models import (
    ApartmentDetails,
    CommercialDetails,
    HouseDetails,
    LandPlotDetails,
    Property,
)

logger = logging.getLogger(__name__)

LOG_PREFIX = "[property_import]"


def _assigned_realtor_for_import_row(user, agency):
    """Draft import: объект всегда с ответственным риэлтором (см. этап 8)."""
    from users.models import RealtorProfile, User

    if isinstance(user, User) and user.is_realtor_role:
        return user
    aid = getattr(agency, "pk", None)
    if aid:
        prof = (
            RealtorProfile.objects.filter(agency_id=aid, user__role=User.Role.REALTOR)
            .select_related("user")
            .order_by("pk")
            .first()
        )
        if prof:
            return prof.user
    return User.objects.filter(role=User.Role.REALTOR).order_by("pk").first()

_PT_VALUES = {c.value for c in PropertyType}
_DEAL_VALUES = {c.value for c in DealType}
_CURRENCY_VALUES = {c.value for c in CurrencyType}
_COMMERCIAL_TYPES = {c.value for c in CommercialType}


def apply_field_mapping(external_row: dict[str, str], mapping: dict[str, str]) -> dict[str, str]:
    """Map external keys to internal field names (values still strings)."""
    out: dict[str, str] = {}
    for ext_key, int_key in (mapping or {}).items():
        if not int_key or not isinstance(int_key, str):
            continue
        if ext_key not in external_row:
            continue
        out[int_key.strip()] = external_row[ext_key]
    return out


def _to_decimal(val: Any, field: str) -> Decimal:
    if val is None or val == "":
        raise ValueError(f"Поле «{field}» обязательно (число).")
    try:
        return Decimal(str(val).replace(",", ".").strip())
    except (InvalidOperation, ValueError) as e:
        raise ValueError(f"Поле «{field}»: неверное число.") from e


def _to_int(val: Any, field: str) -> int:
    if val is None or val == "":
        raise ValueError(f"Поле «{field}» обязательно (целое).")
    try:
        return int(str(val).strip())
    except ValueError as e:
        raise ValueError(f"Поле «{field}»: неверное целое.") from e


def _to_opt_int(val: Any) -> int | None:
    if val is None or str(val).strip() == "":
        return None
    return int(str(val).strip())


def _to_opt_decimal(val: Any) -> Decimal | None:
    if val is None or str(val).strip() == "":
        return None
    return Decimal(str(val).replace(",", ".").strip())


def coerce_and_validate_flat(flat: dict[str, str]) -> dict[str, Any]:
    """Build typed dict for Property + one detail model. Raises ValueError."""
    ptype = (flat.get("property_type") or "").strip()
    if ptype not in _PT_VALUES:
        raise ValueError(
            "property_type обязателен и должен быть одним из значений PropertyType."
        )

    deal = (flat.get("deal_type") or DealType.SALE).strip()
    if deal not in _DEAL_VALUES:
        deal = DealType.SALE

    price = _to_decimal(flat.get("price"), "price")
    city_id = _to_int(flat.get("city"), "city")
    district_id = _to_opt_int(flat.get("district"))

    currency = (flat.get("currency") or CurrencyType.RUB).strip()
    if currency not in _CURRENCY_VALUES:
        currency = CurrencyType.RUB

    data: dict[str, Any] = {
        "property_type": ptype,
        "deal_type": deal,
        "price": price,
        "currency": currency,
        "city_id": city_id,
        "district_id": district_id,
        "street": (flat.get("street") or "").strip(),
        "house_number": (flat.get("house_number") or "").strip(),
        "public_address_text": (flat.get("public_address_text") or "").strip(),
        "short_description": (flat.get("short_description") or "").strip(),
        "description": (flat.get("description") or "").strip(),
    }

    if ptype == PropertyType.APARTMENT:
        data["rooms"] = _to_int(flat.get("rooms"), "rooms")
        data["area_total"] = _to_decimal(flat.get("area_total"), "area_total")
        data["floor"] = _to_int(flat.get("floor"), "floor")
        data["floors_total"] = _to_int(flat.get("floors_total"), "floors_total")
    elif ptype == PropertyType.HOUSE:
        data["house_area"] = _to_decimal(flat.get("house_area"), "house_area")
        data["land_area"] = _to_decimal(flat.get("land_area"), "land_area")
        data["floors_total"] = _to_int(flat.get("floors_total"), "floors_total")
    elif ptype == PropertyType.LAND:
        data["land_area"] = _to_decimal(flat.get("land_area"), "land_area")
    elif ptype == PropertyType.COMMERCIAL:
        data["area_total"] = _to_decimal(flat.get("area_total"), "area_total")
        ct = (flat.get("commercial_type") or "").strip()
        if ct and ct not in _COMMERCIAL_TYPES:
            raise ValueError("commercial_type: недопустимое значение.")
        data["commercial_type"] = ct or None
        data["floor"] = _to_opt_int(flat.get("floor"))
        data["floors_total"] = _to_opt_int(flat.get("floors_total"))
    else:
        raise ValueError("Неподдерживаемый property_type.")

    return data


def _snapshot_for_storage(data: dict[str, Any]) -> dict[str, Any]:
    """JSON-serializable snapshot (decimals → str)."""
    snap: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, Decimal):
            snap[k] = str(v)
        else:
            snap[k] = v
    return snap


def _create_property_and_details(data: dict[str, Any], user, agency) -> Property:
    ptype = data["property_type"]
    assigned = _assigned_realtor_for_import_row(user, agency)
    if assigned is None:
        raise ValueError(
            "Невозможно назначить ответственного риэлтора: в системе нет ни одного "
            "пользователя с ролью «риэлтор»."
        )
    prop = Property(
        status=PropertyStatus.DRAFT,
        is_published=False,
        published_at=None,
        archived_at=None,
        created_by=user,
        assigned_realtor=assigned,
        agency=agency,
        deal_type=data["deal_type"],
        property_type=ptype,
        market_type=None,
        price=data["price"],
        currency=data["currency"],
        city_id=data["city_id"],
        district_id=data.get("district_id"),
        street=data["street"],
        house_number=data["house_number"],
        public_address_text=data["public_address_text"],
        short_description=data["short_description"],
        description=data["description"],
    )
    prop.save()

    if ptype == PropertyType.APARTMENT:
        ApartmentDetails.objects.create(
            property=prop,
            rooms=data["rooms"],
            area_total=data["area_total"],
            floor=data["floor"],
            floors_total=data["floors_total"],
        )
    elif ptype == PropertyType.HOUSE:
        HouseDetails.objects.create(
            property=prop,
            house_area=data["house_area"],
            land_area=data["land_area"],
            floors_total=data["floors_total"],
        )
    elif ptype == PropertyType.LAND:
        LandPlotDetails.objects.create(
            property=prop,
            land_area=data["land_area"],
        )
    elif ptype == PropertyType.COMMERCIAL:
        CommercialDetails.objects.create(
            property=prop,
            commercial_type=data["commercial_type"],
            area_total=data["area_total"],
            floor=data["floor"],
            floors_total=data["floors_total"],
        )

    prop.refresh_from_db()
    return prop


def process_single_import_row(
    job: ImportJob,
    row_index: int,
    external_row: dict[str, str],
    mapping: dict[str, str],
    *,
    base_qs,
    user,
    agency,
) -> None:
    """Create or update ImportItem; create Property draft when valid and not duplicate."""
    ext_id = ""
    mapped_strings = apply_field_mapping(external_row, mapping)
    if "external_id" in mapped_strings:
        ext_id = (mapped_strings.pop("external_id") or "").strip()

    item, _ = ImportItem.objects.get_or_create(
        job=job,
        row_index=row_index,
        defaults={
            "external_id": ext_id,
            "raw_snapshot": dict(mapped_strings),
            "status": ImportItemStatus.PENDING,
        },
    )
    if item.pk and item.status not in (
        ImportItemStatus.PENDING,
        ImportItemStatus.ERROR,
    ):
        return

    item.external_id = ext_id or item.external_id
    item.raw_snapshot = dict(mapped_strings)
    item.error_message = ""
    item.duplicate_candidate_id = None
    item.dedup_outcome = ImportDedupOutcome.NONE
    item.property_id = None
    item.status = ImportItemStatus.PENDING
    item.save(
        update_fields=[
            "external_id",
            "raw_snapshot",
            "error_message",
            "duplicate_candidate",
            "dedup_outcome",
            "property",
            "status",
            "updated_at",
        ]
    )

    try:
        data = coerce_and_validate_flat(mapped_strings)
    except ValueError as e:
        item.status = ImportItemStatus.ERROR
        item.error_message = str(e)
        item.save(update_fields=["status", "error_message", "updated_at"])
        logger.warning(
            "%s job=%s row=%s error=%s",
            LOG_PREFIX,
            job.pk,
            row_index,
            item.error_message,
        )
        return

    snap = _snapshot_for_storage(data)
    item.raw_snapshot = snap
    item.save(update_fields=["raw_snapshot", "updated_at"])

    dup_data = {
        "property_type": data["property_type"],
        "city": data["city_id"],
        "street": data["street"],
        "house_number": data["house_number"],
        "price": data["price"],
    }
    dup = find_exact_import_duplicate(dup_data, base_qs)
    if dup is not None:
        item.status = ImportItemStatus.SKIPPED_DUPLICATE
        item.duplicate_candidate = dup
        item.dedup_outcome = ImportDedupOutcome.EXACT_MATCH
        item.error_message = ""
        item.save(
            update_fields=[
                "status",
                "duplicate_candidate",
                "dedup_outcome",
                "error_message",
                "updated_at",
            ]
        )
        logger.info(
            "%s job=%s row=%s duplicate_candidate_id=%s",
            LOG_PREFIX,
            job.pk,
            row_index,
            dup.pk,
        )
        return

    with transaction.atomic():
        prop = _create_property_and_details(data, user, agency)
        item.property = prop
        item.status = ImportItemStatus.CREATED
        item.save(update_fields=["property", "status", "updated_at"])

    logger.info(
        "%s job=%s row=%s created_property_id=%s",
        LOG_PREFIX,
        job.pk,
        row_index,
        prop.pk,
    )


def run_import_job(job_id: int, base_qs) -> None:
    """
    Execute import for job pk: parse file, process rows, update job counters and status.
    ``base_qs`` should be ``crm_property_queryset_for_user(job.created_by)``.
    """
    try:
        job = ImportJob.objects.get(pk=job_id)
    except ImportJob.DoesNotExist:
        logger.warning("%s job_id=%s not found", LOG_PREFIX, job_id)
        return

    user = job.created_by
    agency = job.agency

    job.status = ImportJobStatus.PROCESSING
    job.error_summary = ""
    job.finished_at = None
    job.row_count_created = 0
    job.row_count_skipped_duplicate = 0
    job.row_count_error = 0
    job.save(
        update_fields=[
            "status",
            "error_summary",
            "finished_at",
            "row_count_created",
            "row_count_skipped_duplicate",
            "row_count_error",
            "updated_at",
        ]
    )

    try:
        rows = load_rows_for_format(job.source_format, job.source_file)
    except Exception as e:
        logger.exception("%s job=%s parse failed", LOG_PREFIX, job.pk)
        job.status = ImportJobStatus.FAILED
        job.error_summary = str(e)[:2000]
        job.row_count_total = 0
        job.finished_at = timezone.now()
        job.save(
            update_fields=[
                "status",
                "error_summary",
                "row_count_total",
                "finished_at",
                "updated_at",
            ]
        )
        return

    mapping = job.field_mapping if isinstance(job.field_mapping, dict) else {}
    job.row_count_total = len(rows)
    job.save(update_fields=["row_count_total", "updated_at"])

    for i, ext_row in enumerate(rows):
        try:
            process_single_import_row(
                job,
                i,
                ext_row,
                mapping,
                base_qs=base_qs,
                user=user,
                agency=agency,
            )
        except Exception as e:
            logger.exception(
                "%s job=%s row=%s unexpected failure",
                LOG_PREFIX,
                job.pk,
                i,
            )
            ImportItem.objects.update_or_create(
                job=job,
                row_index=i,
                defaults={
                    "status": ImportItemStatus.ERROR,
                    "error_message": str(e)[:2000],
                    "raw_snapshot": {},
                },
            )

    created = job.items.filter(status=ImportItemStatus.CREATED).count()
    skipped = job.items.filter(status=ImportItemStatus.SKIPPED_DUPLICATE).count()
    errors = job.items.filter(status=ImportItemStatus.ERROR).count()

    job.row_count_created = created
    job.row_count_skipped_duplicate = skipped
    job.row_count_error = errors
    job.status = ImportJobStatus.COMPLETED
    job.finished_at = timezone.now()
    job.save(
        update_fields=[
            "row_count_created",
            "row_count_skipped_duplicate",
            "row_count_error",
            "status",
            "finished_at",
            "updated_at",
        ]
    )
    logger.info(
        "%s job=%s completed total=%s created=%s skipped_dup=%s errors=%s",
        LOG_PREFIX,
        job.pk,
        job.row_count_total,
        created,
        skipped,
        errors,
    )
