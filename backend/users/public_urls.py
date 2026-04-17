from django.urls import path

from . import public_views

app_name = "users_public"

urlpatterns = [
    path("<str:crm_id>/", public_views.PublicRealtorDetailView.as_view(), name="realtor-detail"),
]
