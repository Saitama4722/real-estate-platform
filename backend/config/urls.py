"""
URL configuration for the real estate platform backend.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

admin.site.site_header = "Недвижимость — администрирование"
admin.site.site_title = "Админка"
admin.site.index_title = "Панель управления"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/articles/", include("articles.urls")),
    path("api/locations/", include("locations.urls")),
    path("api/properties/", include("properties.urls")),
    path("api/crm/properties/", include("properties.crm_urls")),
    path("api/leads/", include("leads.urls")),
    path("api/crm/leads/", include("leads.crm_urls")),
    path("api/crm/realtors/", include("users.crm_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
