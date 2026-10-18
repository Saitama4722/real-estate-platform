"""
Массовые действия над заявками и заявками на продажу (2026-10-18).

    POST …/bulk-mark-read/   {"ids": [..]} | {"all": true}   любой сотрудник CRM
    POST …/bulk-hide/        {"ids": [..]} | {"all": true}   только риэлтор
    POST …/bulk-unhide/      {"ids": [..]} | {"all": true}   только риэлтор
    POST …/bulk-delete/      {"ids": [..]}                   только суперадмин/админ

⭐ ПРАВИЛА

1. **Права проверяются ПО КАЖДОЙ строке, и запрос — «всё или ничего».** Набор
   id сверяется с ТЕМ ЖЕ queryset, что отдаёт список этому пользователю
   (свои + свободные для риэлтора). Хоть один чужой/несуществующий id → 403
   на весь запрос, ничего не меняется. Всё — в одной транзакции.
2. **`{"all": true}`** берёт ровно то, что пользователь видит сейчас: те же
   параметры запроса (scope/status/search), что и у списка. Так работает
   «Отметить все прочитанными» без выгрузки id со всех страниц.
3. **«Прочитано» — одно действие на оба слоя.** Квитанция прочтения (боковое
   меню, точки в строках) И уведомления колокольчика по этим заявкам
   гасятся вместе — см. `mark_items_read`.
4. **«Скрыть» — личный архив** (`CrmHiddenItem`): данные не трогаются, у
   других сотрудников ничего не меняется. Скрытие заодно гасит прочтение и
   уведомления: скрытая заявка не должна зажигать бейдж.
5. **Удаление — только суперадмин/админ**, с записью в журнал активности.
   Риэлтор удалять массово не может вовсе.
"""
from __future__ import annotations

from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

MAX_BULK = 500


def _parse_ids(data) -> list[int] | None:
    """`None` = выбрано «всё по фильтру»; иначе список целых id."""
    if isinstance(data, dict) and data.get("all") is True:
        return None
    raw = data.get("ids") if isinstance(data, dict) else None
    if not isinstance(raw, list) or not raw:
        raise ValidationError({"ids": "Передайте непустой список id или all=true."})
    if len(raw) > MAX_BULK:
        raise ValidationError({"ids": f"Не больше {MAX_BULK} заявок за раз."})
    try:
        ids = sorted({int(x) for x in raw})
    except (TypeError, ValueError):
        raise ValidationError({"ids": "id должны быть целыми числами."})
    return ids


def _target_kwargs(kind: str, obj) -> dict:
    return {"lead": obj} if kind == "lead" else {"sale_request": obj}


def mark_items_read(user, kind: str, items) -> dict:
    """Квитанции + уведомления колокольчика по этим заявкам — одним действием."""
    from django.utils import timezone

    from common.crm_notify import is_workflow_realtor
    from common.models import CrmNotification
    from leads.models import LeadReadReceipt
    from submissions.models import SaleRequestReadReceipt

    items = list(items)
    if not is_workflow_realtor(user) or not items:
        return {"receipts_created": 0, "notifications_read": 0}
    if kind == "lead":
        have = set(
            LeadReadReceipt.objects.filter(user=user, lead__in=items).values_list("lead_id", flat=True)
        )
        new = [LeadReadReceipt(user=user, lead=o) for o in items if o.pk not in have]
        LeadReadReceipt.objects.bulk_create(new, ignore_conflicts=True)
        notif = CrmNotification.objects.filter(recipient=user, lead__in=items)
    else:
        have = set(
            SaleRequestReadReceipt.objects.filter(user=user, sale_request__in=items).values_list(
                "sale_request_id", flat=True
            )
        )
        new = [SaleRequestReadReceipt(user=user, sale_request=o) for o in items if o.pk not in have]
        SaleRequestReadReceipt.objects.bulk_create(new, ignore_conflicts=True)
        notif = CrmNotification.objects.filter(recipient=user, sale_request__in=items)
    read = notif.filter(read_at__isnull=True).update(read_at=timezone.now())
    return {"receipts_created": len(new), "notifications_read": read}


def hidden_ids(user, kind: str):
    """id заявок, которые ЭТОТ пользователь убрал в свой архив (подзапрос)."""
    from common.models import CrmHiddenItem

    field = "lead_id" if kind == "lead" else "sale_request_id"
    return CrmHiddenItem.objects.filter(user=user, **{f"{field}__isnull": False}).values(field)


class CrmBulkActionsMixin:
    """
    Подмешивается к `CrmLeadViewSet` и `CrmSaleRequestViewSet`.

    Наследник задаёт `bulk_kind` ("lead" / "sale_request"), `bulk_label`
    (для журнала) и `bulk_access_queryset()` — ВСЕ заявки, к которым
    у пользователя есть доступ, включая скрытые им самим (иначе из архива
    нельзя было бы ничего вернуть).
    """

    bulk_kind = "lead"
    bulk_label = "заявок"

    def bulk_access_queryset(self):  # pragma: no cover - overridden
        raise NotImplementedError

    def _bulk_resolve(self, request):
        ids = _parse_ids(request.data)
        if ids is None:
            # «Всё по текущему фильтру» — ровно видимый список.
            return list(self.filter_queryset(self.get_queryset()).order_by().distinct()[:MAX_BULK])
        allowed = list(self.bulk_access_queryset().filter(pk__in=ids))
        missing = sorted(set(ids) - {o.pk for o in allowed})
        if missing:
            raise PermissionDenied(
                detail=f"Нет доступа к заявкам: {', '.join('#' + str(x) for x in missing[:20])}. Ничего не изменено."
            )
        return allowed

    def _bulk_response(self, action_name, items, **extra):
        return Response(
            {"action": action_name, "count": len(items), "ids": [o.pk for o in items], **extra},
            status=status.HTTP_200_OK,
        )

    def _require_realtor(self, request, what):
        from common.crm_notify import is_workflow_realtor

        if not is_workflow_realtor(request.user):
            raise PermissionDenied(detail=f"{what} доступно только риэлторам.")

    def bulk_mark_read(self, request):
        with transaction.atomic():
            items = self._bulk_resolve(request)
            result = mark_items_read(request.user, self.bulk_kind, items)
        return self._bulk_response("mark_read", items, **result)

    def bulk_hide(self, request):
        from common.models import CrmHiddenItem

        self._require_realtor(request, "Скрытие")
        with transaction.atomic():
            items = self._bulk_resolve(request)
            already = set(
                CrmHiddenItem.objects.filter(
                    user=request.user, **{f"{self.bulk_kind}__in": items}
                ).values_list(f"{self.bulk_kind}_id", flat=True)
            )
            CrmHiddenItem.objects.bulk_create(
                [
                    CrmHiddenItem(user=request.user, **_target_kwargs(self.bulk_kind, o))
                    for o in items
                    if o.pk not in already
                ],
                ignore_conflicts=True,
            )
            mark_items_read(request.user, self.bulk_kind, items)
        return self._bulk_response("hide", items)

    def bulk_unhide(self, request):
        from common.models import CrmHiddenItem

        self._require_realtor(request, "Возврат из архива")
        with transaction.atomic():
            items = self._bulk_resolve(request)
            CrmHiddenItem.objects.filter(
                user=request.user, **{f"{self.bulk_kind}__in": items}
            ).delete()
        return self._bulk_response("unhide", items)

    def bulk_delete(self, request):
        from users.activity import record_employee_activity
        from users.models import EmployeeActivityLog

        if not getattr(request.user, "has_staff_level_access", False):
            raise PermissionDenied(detail="Удалять заявки может только администратор.")
        if isinstance(request.data, dict) and request.data.get("all") is True:
            raise ValidationError({"ids": "Для удаления передайте явный список id."})
        with transaction.atomic():
            items = self._bulk_resolve(request)
            ids = [o.pk for o in items]
            for o in items:
                o.delete()
            action = (
                EmployeeActivityLog.ActionType.BULK_DELETE_LEADS
                if self.bulk_kind == "lead"
                else EmployeeActivityLog.ActionType.BULK_DELETE_SALE_REQUESTS
            )
            shown = ", ".join(f"#{x}" for x in ids[:40])
            more = f" и ещё {len(ids) - 40}" if len(ids) > 40 else ""
            record_employee_activity(
                request, request.user, action, details=f"{len(ids)} {self.bulk_label}: {shown}{more}"
            )
        return Response({"action": "delete", "count": len(ids), "ids": ids})
