from django.urls import path

from common.crm_notifications_views import CrmUnreadCountsView

urlpatterns = [
    path(
        "unread-counts/",
        CrmUnreadCountsView.as_view(),
        name="crm-notifications-unread-counts",
    ),
]
