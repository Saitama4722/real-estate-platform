"""
Публичные эндпоинты профиля риэлтора (без аутентификации).
"""
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from properties.choices import PropertyStatus
from properties.models import Property

from .models import RealtorProfile, User
from .serializers import PublicRealtorSerializer, _absolute_media_url


class PublicRealtorDetailView(APIView):
    """
    GET /api/realtors/<crm_id>/
    Только активные ОПУБЛИКОВАННЫЕ риэлторы; без email и CRM-метаданных.

    ⚠ `is_public` — «Показывать на сайте» — ЗДЕСЬ И ЕСТЬ то место, где флаг
    работает. Он редактируется в трёх интерфейсах (CRM-панель, /api/auth/me/,
    админка), но раньше не проверялся ни одним публичным эндпоинтом: страница
    отдавалась для любого активного риэлтора, то есть галочка вводила в
    заблуждение. Профиль без `is_public=True` (в том числе полное отсутствие
    профиля) теперь 404 — новый риэлтор остаётся черновиком, пока
    суперадмин не отредактирует биографию и не опубликует его.

    Ссылки на страницу гасятся тем же признаком (`realtor_profile_is_public`),
    поэтому мёртвых ссылок на 404 не возникает.
    """

    permission_classes = [AllowAny]
    http_method_names = ["get", "head", "options"]

    def get(self, request, crm_id, *args, **kwargs):
        raw = (crm_id or "").strip()
        user = get_object_or_404(
            User.objects.filter(
                role=User.Role.REALTOR,
                is_active=True,
                realtor_profile__is_public=True,
            ),
            crm_id__iexact=raw,
        )
        profile = RealtorProfile.objects.filter(user_id=user.pk).first()

        if profile and (profile.public_name or "").strip():
            display_name = (profile.public_name or "").strip()
        else:
            display_name = f"{user.first_name} {user.last_name}".strip() or user.crm_id

        if profile and (profile.public_phone or "").strip():
            phone = (profile.public_phone or "").strip()
        else:
            phone = (user.phone or "").strip()

        avatar = None
        if profile and profile.photo:
            avatar = _absolute_media_url(request, profile.photo)
        if not avatar:
            avatar = _absolute_media_url(request, user.avatar)

        short_bio = ""
        if profile and (profile.short_bio or "").strip():
            short_bio = (profile.short_bio or "").strip()

        published_properties_count = Property.objects.filter(
            assigned_realtor=user,
            status=PropertyStatus.PUBLISHED,
            is_published=True,
        ).count()

        payload = {
            "crm_id": user.crm_id,
            "display_name": display_name,
            "avatar": avatar,
            "phone": phone,
            "published_properties_count": published_properties_count,
            "short_bio": short_bio,
        }
        ser = PublicRealtorSerializer(data=payload)
        ser.is_valid(raise_exception=True)
        return Response(ser.data)
