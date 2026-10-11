"""
Unique storage keys for every uploaded file.

``upload_to=UniqueUploadTo("properties/photos")`` stores a file at

    properties/photos/<yyyy>/<mm>/<uuid4 hex>.<ext>

⛔ RULE: every ``upload_to`` in this project is a ``UniqueUploadTo``. Never key a
stored file on the uploader's filename.

Why: names used to be derived from the client's own filename (``IMG_0042.jpg``,
``photo.jpg``). On S3/R2 with ``file_overwrite=True`` two uploads with the same
name mapped to ONE object, the second silently replaced the first, and both DB
rows pointed at it. A UUID key makes the name unique at the source, on every
backend; ``file_overwrite=False`` in ``common/media_storage.py`` is only the
second safety net.

- The extension is the one in the name handed to ``FieldFile.save()``, lower-
  cased. Compression renames to ``.jpg`` (``image_compression._jpeg_name``) and
  derivatives are saved as ``*.jpg``, and both go through this callable, so the
  stored key keeps ``.jpg``. The extension matters: django-storages derives the
  object's Content-Type from it.
- The folder prefixes are the pre-existing ones, so ``/media/<folder>/...`` URLs
  and the Next.js ``/media/`` proxy keep their shape. Rows stored before this
  change keep their old keys. Nothing is renamed or migrated.
- ⚠ Migrations reference this class by import path
  (``common.upload_paths.UniqueUploadTo``). Moving or renaming it breaks every
  migration that froze it; keep it here.
"""
from __future__ import annotations

import posixpath
import re
import uuid

from django.utils import timezone
from django.utils.deconstruct import deconstructible

# A sane extension only. Anything else (none, too long, odd characters) is
# dropped rather than stored. The key stays unique either way.
_EXT_RE = re.compile(r"^\.[a-z0-9]{1,8}$")


@deconstructible
class UniqueUploadTo:
    def __init__(self, folder: str):
        self.folder = folder.strip("/")

    def __call__(self, instance, filename: str) -> str:
        ext = posixpath.splitext(filename.replace("\\", "/"))[1].lower()
        if not _EXT_RE.match(ext):
            ext = ""
        now = timezone.now()
        return f"{self.folder}/{now:%Y}/{now:%m}/{uuid.uuid4().hex}{ext}"

    def __eq__(self, other) -> bool:
        return isinstance(other, UniqueUploadTo) and other.folder == self.folder

    def __hash__(self) -> int:
        return hash(self.folder)
