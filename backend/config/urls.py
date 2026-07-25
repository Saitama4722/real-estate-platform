"""
URL configuration for the real estate platform backend.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from common.homepage_views import (
    HomepageTextBlockCrmPatchView,
    HomepageTextBlockPublicListView,
)
from users import views as users_views

admin.site.site_header = "Недвижимость — администрирование"
admin.site.site_title = "Админка"
admin.site.index_title = "Панель управления"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/realtors/", include("users.public_urls")),
    path("api/articles/", include("articles.urls")),
    path(
        "api/homepage/text-blocks/",
        HomepageTextBlockPublicListView.as_view(),
        name="homepage-text-blocks-public",
    ),
    path("api/homepage/", include("common.homepage_urls")),
    path("api/locations/", include("locations.urls")),
    path("api/properties/", include("properties.urls")),
    path("api/crm/properties/", include("properties.crm_urls")),
    path("api/leads/", include("leads.urls")),
    path("api/crm/leads/", include("leads.crm_urls")),
    path("api/sale-requests/", include("submissions.urls")),
    path("api/crm/sale-requests/", include("submissions.crm_urls")),
    path("api/crm/owners/", include("owners.crm_urls")),
    path("api/crm/realtors/", include("users.crm_urls")),
    path(
        "api/crm/activity-logs/",
        users_views.CrmEmployeeActivityLogListView.as_view(),
        name="crm-activity-logs",
    ),
    path(
        "api/crm/homepage/text-blocks/<slug:key>/",
        HomepageTextBlockCrmPatchView.as_view(),
        name="crm-homepage-text-block-patch",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
