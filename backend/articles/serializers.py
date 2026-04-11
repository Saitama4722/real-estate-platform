from rest_framework import serializers

from articles.models import Article


class ArticlePublicSerializer(serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = [
            "slug",
            "title",
            "excerpt",
            "body",
            "published_at",
            "cover_image",
        ]

    def get_cover_image(self, obj):
        if not obj.cover_image:
            return None
        request = self.context.get("request")
        path = obj.cover_image.url
        if request:
            return request.build_absolute_uri(path)
        return path
