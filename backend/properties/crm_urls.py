from django.urls import path
from rest_framework.routers import DefaultRouter

from properties.views import (
    CrmPropertyPhotoViewSet,
    CrmPropertyVideoViewSet,
    CrmPropertyViewSet,
)

router = DefaultRouter()
router.register(r"", CrmPropertyViewSet, basename="crm-property")

_photo = CrmPropertyPhotoViewSet.as_view
_video = CrmPropertyVideoViewSet.as_view

urlpatterns = [
    path(
        "<int:property_pk>/photos/reorder/",
        _photo({"post": "reorder"}),
    ),
    path(
        "<int:property_pk>/photos/set_main/",
        _photo({"post": "set_main"}),
    ),
    path(
        "<int:property_pk>/photos/<int:pk>/",
        _photo(
            {
                "get": "retrieve",
                "delete": "destroy",
            }
        ),
    ),
    path(
        "<int:property_pk>/photos/",
        _photo({"get": "list", "post": "create"}),
    ),
    path(
        "<int:property_pk>/videos/<int:pk>/",
        _video(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
    ),
    path(
        "<int:property_pk>/videos/",
        _video({"get": "list", "post": "create"}),
    ),
] + router.urls
