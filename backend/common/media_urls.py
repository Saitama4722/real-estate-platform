"""
One definition of how a stored media path becomes a URL in an API response.

The rule is: return ``FieldFile.url`` VERBATIM. That single rule produces both
behaviours the project needs, because the active storage backend already knows
where the file lives:

    MEDIA_STORAGE_BACKEND=local  ->  /media/users/avatars/x.jpg
    MEDIA_STORAGE_BACKEND=r2     ->  https://pub-<id>.r2.dev/users/avatars/x.jpg

Nothing here inspects MEDIA_STORAGE_BACKEND. The storage does that; duplicating
the decision is how the two competing patterns below came to exist.

⚠ DO NOT wrap this in ``request.build_absolute_uri()``.
   Under r2 that call is a harmless no-op — the URL already carries a scheme and
   host, and Django returns it unchanged `[measured]`. Under local it is NOT a
   no-op: it rewrites ``/media/…`` into ``http://<backend-host>/media/…``,
   embedding the PRIVATE Django host, which the browser cannot reach in
   production (Next.js proxies ``/media/*`` precisely so it never has to).
   Seven call sites did this and three did not; unifying them is why this module
   exists. Adding an eighth re-opens the split.

⚠ Database rows are unaffected. ``FileField`` still stores the relative key
   (``users/avatars/x.jpg``); only the rendering of that key changes.
"""
from __future__ import annotations

from rest_framework import serializers


def media_url(file_field) -> str | None:
    """
    URL for a FileField/ImageField value, or None when there is no file.

    Accepts a ``FieldFile`` (or None). An unset field is falsy, and a field whose
    storage cannot build a URL raises ValueError — both yield None so a caller
    never has to guard.
    """
    if not file_field:
        return None
    try:
        return file_field.url
    except (ValueError, AttributeError):
        return None


class MediaURLField(serializers.Field):
    """
    Read-only serializer field for a FileField/ImageField.

    Use this instead of letting DRF render the model field itself: DRF's own
    ``FileField.to_representation`` applies ``build_absolute_uri`` when a request
    is in context, which is exactly the behaviour documented above as wrong.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("read_only", True)
        super().__init__(**kwargs)

    def to_representation(self, value):
        return media_url(value)
