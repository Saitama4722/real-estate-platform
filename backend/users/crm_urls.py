from rest_framework.routers import DefaultRouter

from .crm_views import CrmRealtorViewSet

router = DefaultRouter()
router.register(r"", CrmRealtorViewSet, basename="crm-realtor")

urlpatterns = router.urls
