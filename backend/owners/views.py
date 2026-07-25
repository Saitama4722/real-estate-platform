import logging

from django.db.models import CharField, F, Func, Q, Value
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from users.permissions import IsCrmUser

from .models import Owner
from .serializers import OwnerSerializer

logger = logging.getLogger(__name__)


def pid_search_condition(search: str):
    """
    Match a search term against the PID of any property linked to the owner.

    PIDs are `PID` + a 6-digit zero-padded counter (`PID000047`,
    `Property.allocate_next_crm_property_id`), which makes the term unambiguous:

    - a term starting with "PID" is matched as a substring, so both the full
      `PID000047` and a partial `pid0000` work;
    - a bare number is matched as that property's NUMBER, zero-padded — "47",
      "0047" and "000047" all resolve to exactly `PID000047`. Deliberately an
      exact match, not a substring: a substring "47" would also drag in
      PID000470 / PID000147, and bare numbers are also phone fragments, so
      keeping this precise stops the phone search from getting noisy;
    - anything else (a name) never touches PIDs at all.

    Returns None when the term cannot denote a PID.
    """
    term = search.upper()
    if term.startswith("PID"):
        return Q(properties__crm_property_id__icontains=term)
    if term.isdigit() and len(term) <= 6:
        return Q(properties__crm_property_id__iexact=f"PID{term.zfill(6)}")
    return None


class CrmOwnerViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    CRM registry of property owners (собственники). CRM-ONLY (IsCrmUser) — this
    data is never exposed on any public endpoint.

    - GET  /api/crm/owners/?search=<phone, ФИО or PID>  → find/reuse existing
      owners. Matching is an OR of: ФИО substring, phone digits, or the PID of
      any property linked to the owner (see `pid_search_condition`).
    - POST /api/crm/owners/                         → create a new owner.
    - PATCH /api/crm/owners/{id}/                    → edit (affects ALL linked
      properties — a deliberate action from the UI).
    - DELETE /api/crm/owners/{id}/                   → staff-level only.

    Any CRM user (realtor/admin) may view, search, create and edit owners —
    consistent with the CRM's general realtor visibility level.
    """

    permission_classes = [IsCrmUser]
    serializer_class = OwnerSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Owner.objects.all().prefetch_related("properties")
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            # Match by ФИО substring OR by phone. Phones are stored FORMATTED
            # (e.g. "+7 (999) 888-77-66"), so a raw-digit search term would never
            # substring-match. Normalize the STORED phone to digits-only in SQL
            # (strip every non-digit) and compare against the search term's digits,
            # so "9998887766" or "888-77" both find "+7 (999) 888-77-66".
            digits = "".join(ch for ch in search if ch.isdigit())
            cond = Q(full_name__icontains=search)
            if digits:
                qs = qs.annotate(
                    _phone_digits=Func(
                        F("phone"),
                        Value(r"\D"),
                        Value(""),
                        Value("g"),
                        function="regexp_replace",
                        output_field=CharField(),
                    )
                )
                cond |= Q(_phone_digits__contains=digits)
            else:
                cond |= Q(phone__icontains=search)
            # Also find an owner by the PID of a property they own ("who owns
            # PID000047?"), purely additive to the ФИО/phone matching above.
            pid_cond = pid_search_condition(search)
            if pid_cond is not None:
                cond |= pid_cond
                # The PID branch joins `properties`, which repeats an owner once
                # per matching property — collapse those back to one row.
                qs = qs.filter(cond).distinct()
            else:
                qs = qs.filter(cond)
        return qs

    def destroy(self, request, *args, **kwargs):
        # Deleting a shared owner affects data integrity across linked properties
        # (they'd become owner-less via SET_NULL). Restrict to staff-level.
        if not getattr(request.user, "has_staff_level_access", False):
            raise PermissionDenied(
                detail="Удаление собственника доступно только администратору."
            )
        instance = self.get_object()
        logger.info(
            "owner_deleted id=%s user_id=%s",
            instance.pk,
            getattr(request.user, "pk", None),
        )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
