from rest_framework.routers import DefaultRouter

from submissions.views import CrmSaleRequestViewSet

router = DefaultRouter()
router.register(r"", CrmSaleRequestViewSet, basename="crm-sale-request")

urlpatterns = router.urls
