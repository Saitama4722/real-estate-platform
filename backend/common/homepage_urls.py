from django.urls import path

from common.homepage_views import HomepageTextBlockPublicListView

urlpatterns = [
    path(
        "text-blocks/",
        HomepageTextBlockPublicListView.as_view(),
        name="homepage-text-blocks-public",
    ),
]
