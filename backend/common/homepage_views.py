from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.homepage_constants import HOMEPAGE_TEXT_BLOCK_KEYS
from common.homepage_serializers import (
    HomepageTextBlockCrmPatchSerializer,
    HomepageTextBlockPublicSerializer,
)
from common.models import HomepageTextBlock
from users.models import User


class HomepageTextBlockPublicListView(APIView):
    """
    GET /api/homepage/text-blocks/
    Публичный список текстов главной (только значения по заранее заданным ключам).
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["get", "head", "options"]

    def get(self, request, *args, **kwargs):
        rows = HomepageTextBlock.objects.all().order_by("key")
        ser = HomepageTextBlockPublicSerializer(rows, many=True)
        return Response({"blocks": ser.data})


class HomepageTextBlockCrmPatchView(APIView):
    """
    PATCH /api/crm/homepage/text-blocks/<key>/
    Только superadmin / admin.
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["patch", "head", "options"]

    def patch(self, request, key, *args, **kwargs):
        user = request.user
        if (
            not isinstance(user, User)
            or not getattr(user, "is_active", False)
            or not user.has_staff_level_access
        ):
            raise PermissionDenied(
                detail="Редактирование текстов главной страницы доступно только администратору.",
            )
        if key not in HOMEPAGE_TEXT_BLOCK_KEYS:
            return Response(
                {"detail": "Неизвестный ключ блока."},
                status=status.HTTP_404_NOT_FOUND,
            )
        instance = get_object_or_404(HomepageTextBlock, pk=key)
        ser = HomepageTextBlockCrmPatchSerializer(
            instance,
            data=request.data,
            partial=True,
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(
            HomepageTextBlockPublicSerializer(instance).data,
            status=status.HTTP_200_OK,
        )
