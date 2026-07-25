from rest_framework.routers import DefaultRouter

from owners.views import CrmOwnerViewSet

router = DefaultRouter()
router.register(r"", CrmOwnerViewSet, basename="crm-owner")

urlpatterns = router.urls
