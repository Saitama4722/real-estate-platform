from rest_framework import serializers

from common.models import HomepageTextBlock


class HomepageTextBlockPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomepageTextBlock
        fields = ("key", "value")


class HomepageTextBlockCrmPatchSerializer(serializers.ModelSerializer):
    value = serializers.CharField(allow_blank=True, max_length=20_000)

    class Meta:
        model = HomepageTextBlock
        fields = ("value",)
