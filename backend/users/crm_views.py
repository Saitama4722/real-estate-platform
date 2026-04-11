"""
CRM API: управление риэлторами (только admin / superadmin).
"""
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import User
from .permissions import IsCrmStaffManager
from .serializers import RealtorCrmReadSerializer, RealtorCrmWriteSerializer


class CrmRealtorViewSet(viewsets.ModelViewSet):
    """
    CRUD по пользователям с ролью «Риэлтор»: список, создание, правка, удаление.
    Отключение: PATCH/PUT с is_active=false.
    """

    permission_classes = [IsAuthenticated, IsCrmStaffManager]
    queryset = User.objects.filter(role=User.Role.REALTOR).order_by("crm_id", "id")
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return RealtorCrmWriteSerializer
        return RealtorCrmReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        read = RealtorCrmReadSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(read.data)
        return Response(read.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        read = RealtorCrmReadSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        return Response(read.data)
