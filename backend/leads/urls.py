from django.urls import path
from rest_framework.routers import DefaultRouter

from leads.views import PublicLeadCaptchaView, PublicLeadViewSet

router = DefaultRouter()
router.register(r"", PublicLeadViewSet, basename="lead")

urlpatterns = [
    path("captcha/", PublicLeadCaptchaView.as_view(), name="public-lead-captcha"),
] + router.urls

