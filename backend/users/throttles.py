"""
Rate limiting for the authentication endpoints.

Follows the hand-rolled pattern already used by PublicLeadThrottle and
PhoneRevealThrottle: a SimpleRateThrottle subclass with the rate hardcoded in
get_rate(), so no DEFAULT_THROTTLE_RATES entry is needed in settings.

⚠ CACHES is locmem (config/settings.py), which is PER PROCESS. Under several
Gunicorn workers each worker keeps its own counter, so the effective limit is
roughly rate × worker_count. Point Django's cache at the Redis that already
runs for Celery if the limit ever needs to be exact.
"""
import math

from rest_framework.exceptions import APIException, Throttled
from rest_framework.throttling import SimpleRateThrottle


class ThrottledRu(Throttled):
    """
    Throttled without DRF's English tail.

    `Throttled.__init__` appends "Expected available in N seconds." to whatever
    detail you pass. That sentence is not translated by DRF's ru catalogue
    `[measured]`, so a custom Russian detail comes back half-English. The wait
    is already carried by the `Retry-After` header, which is what the frontend
    reads, so the sentence adds nothing.

    `self.wait` is still set — DRF's exception handler needs it to emit
    Retry-After at all.
    """

    def __init__(self, wait=None, detail=None, code=None):
        APIException.__init__(self, detail, code)
        self.wait = None if wait is None else math.ceil(wait)


class LoginThrottle(SimpleRateThrottle):
    """
    Ограничение частоты попыток входа (по IP).

    Login was previously unlimited, which left the endpoint open to password
    guessing and credential stuffing. Keyed on IP rather than on the submitted
    email so that an attacker cannot dodge the limit by rotating addresses —
    and so the limit itself cannot be used to probe which emails exist.
    """

    scope = "login"

    def get_rate(self):
        return "10/minute"

    def allow_request(self, request, view):
        # Only the credential POST is limited; a preflight or a stray GET is not
        # an attempt.
        if request.method != "POST":
            return True
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
