from rest_framework.routers import DefaultRouter

from articles.views import ArticlePublicViewSet

router = DefaultRouter()
router.register(r"", ArticlePublicViewSet, basename="article")

urlpatterns = router.urls
