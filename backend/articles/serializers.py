from rest_framework import serializers

from common.media_urls import media_url

from articles.models import Article, ArticleSection


class ArticleSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleSection
        fields = ["heading", "text"]


class ArticlePublicSerializer(serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()
    # Model ordering is ["order", "id"], so the nested list arrives in reading
    # order. Empty sections are dropped HERE rather than in the client: a
    # heading with no text must never reach the page or the table of contents.
    sections = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = [
            "slug",
            "title",
            "excerpt",
            "intro",
            "sections",
            "conclusion_title",
            "conclusion",
            "category",
            "published_at",
            "cover_image",
        ]

    def get_sections(self, obj):
        sections = [s for s in obj.sections.all() if s.heading.strip() and s.text.strip()]
        return ArticleSectionSerializer(sections, many=True).data

    def get_cover_image(self, obj):
        return media_url(obj.cover_image)
