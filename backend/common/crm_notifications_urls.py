from django.urls import path

from common.crm_notifications_views import (
    CrmNotificationListView,
    CrmNotificationMarkAllReadView,
    CrmNotificationMarkReadView,
    CrmUnreadCountsView,
)

urlpatterns = [
    path("", CrmNotificationListView.as_view(), name="crm-notifications-list"),
    path(
        "unread-counts/",
        CrmUnreadCountsView.as_view(),
        name="crm-notifications-unread-counts",
    ),
    path(
        "mark-all-read/",
        CrmNotificationMarkAllReadView.as_view(),
        name="crm-notifications-mark-all-read",
    ),
    path(
        "<int:pk>/mark-read/",
        CrmNotificationMarkReadView.as_view(),
        name="crm-notifications-mark-read",
    ),
]
