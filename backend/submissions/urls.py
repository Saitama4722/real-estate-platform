from rest_framework.routers import DefaultRouter

from submissions.views import PublicSaleRequestViewSet

router = DefaultRouter()
router.register(r"", PublicSaleRequestViewSet, basename="sale-request")

urlpatterns = router.urls
