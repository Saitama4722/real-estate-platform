from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ReadOnlyModelViewSet

from articles.choices import ArticleStatus
from articles.models import Article
from articles.serializers import ArticlePublicSerializer


class ArticlePublicViewSet(ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    lookup_field = "slug"
    lookup_value_regex = "[^/]+"
    serializer_class = ArticlePublicSerializer

    def get_queryset(self):
        return Article.objects.filter(
            status=ArticleStatus.PUBLISHED,
            published_at__isnull=False,
        ).order_by("-published_at", "-created_at")
