from rest_framework.routers import DefaultRouter



from leads.views import CrmLeadViewSet



router = DefaultRouter()

router.register(r"", CrmLeadViewSet, basename="crm-lead")



urlpatterns = router.urls

