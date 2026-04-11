"""
CSV and XML parsing for property import (Stage 14.6).

CSV:
    UTF-8 with optional BOM (utf-8-sig). If decoding fails, falls back to cp1251
    once — minimal RU-Windows compatibility without full charset detection.

XML (explicit structure):
    Root element ``properties``; each direct child ``property`` is one record.
    Each ``property`` element's direct child elements provide fields: local tag
    name (case-sensitive as stored) maps to string values (text stripped).
    Namespaces are not supported on this step.
"""

from __future__ import annotations

import csv
import io
import logging
import xml.etree.ElementTree as ET
from typing import Any

logger = logging.getLogger(__name__)


def parse_import_csv_bytes(data: bytes) -> list[dict[str, str]]:
    """Return list of row dicts (string values, stripped keys from header)."""
    text: str | None = None
    for enc in ("utf-8-sig", "utf-8"):
        try:
            text = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        try:
            text = data.decode("cp1251")
            logger.info("[property_import] csv decoded as cp1251")
        except UnicodeDecodeError as e:
            raise ValueError("CSV: не удалось декодировать файл (utf-8/cp1251).") from e

    stream = io.StringIO(text)
    reader = csv.DictReader(stream)
    if reader.fieldnames is None:
        return []
    rows: list[dict[str, str]] = []
    for raw in reader:
        row: dict[str, str] = {}
        for k, v in raw.items():
            if k is None:
                continue
            key = (k or "").strip()
            if not key:
                continue
            row[key] = (v or "").strip()
        rows.append(row)
    return rows


def parse_import_xml_bytes(data: bytes) -> list[dict[str, str]]:
    """
    Parse XML into row dicts.

    Expected shape::

        <properties>
          <property>
            <field_name>value</field_name>
            ...
          </property>
        </properties>
    """
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        raise ValueError(f"XML: ошибка разбора: {e}") from e

    if root.tag != "properties":
        raise ValueError(
            "XML: ожидается корневой элемент <properties> (см. import_parsers)."
        )

    rows: list[dict[str, str]] = []
    for prop_el in root.findall("./property"):
        row: dict[str, str] = {}
        for child in list(prop_el):
            tag = child.tag
            if not tag:
                continue
            text = "".join(child.itertext()).strip() if child is not None else ""
            row[tag] = text
        rows.append(row)
    return rows


def load_rows_for_format(source_format: str, file_field: Any) -> list[dict[str, str]]:
    """Read uploaded FileField / FieldFile and return external-keyed rows."""
    file_field.open("rb")
    try:
        raw = file_field.read()
    finally:
        file_field.close()

    if source_format == "csv":
        return parse_import_csv_bytes(raw)
    if source_format == "xml":
        return parse_import_xml_bytes(raw)
    raise ValueError(f"Неизвестный формат: {source_format}")
