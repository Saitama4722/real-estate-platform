from rest_framework import serializers

from common.homepage_constants import PHONE_TEXT_BLOCK_KEYS
from common.models import HomepageTextBlock
from common.phone import normalize_ru_phone

INVALID_PHONE_MESSAGE = (
    "Укажите корректный номер телефона — например, +7 (928) 333-08-37. "
    "Чтобы убрать телефон из шапки сайта, оставьте поле пустым."
)


class HomepageTextBlockPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomepageTextBlock
        fields = ("key", "value")


class HomepageTextBlockCrmPatchSerializer(serializers.ModelSerializer):
    value = serializers.CharField(allow_blank=True, max_length=20_000)

    class Meta:
        model = HomepageTextBlock
        fields = ("value",)

    def validate_value(self, value):
        """
        Free text for copy blocks; a canonical phone for phone keys.

        The key comes from `self.instance` because the view resolves the row
        before instantiating this serializer — the key is never client-supplied
        here, so it cannot be used to pick a laxer branch.
        """
        key = getattr(self.instance, "key", None)
        if key in PHONE_TEXT_BLOCK_KEYS:
            normalized = normalize_ru_phone(value)
            if normalized is None:
                raise serializers.ValidationError(INVALID_PHONE_MESSAGE)
            return normalized
        return value
