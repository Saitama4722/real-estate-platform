from rest_framework import serializers

from .models import City, District, Neighborhood, ResidentialComplex


class CityShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ["id", "name", "slug"]


class DistrictShortSerializer(serializers.ModelSerializer):
    """
    Short nested representation used inside Neighborhood/ResidentialComplex.
    """

    class Meta:
        model = District
        fields = ["id", "name", "slug"]


class NeighborhoodShortSerializer(serializers.ModelSerializer):
    """
    Short nested representation used inside ResidentialComplex.
    """

    class Meta:
        model = Neighborhood
        fields = ["id", "name", "slug"]


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = "__all__"


class DistrictSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True)

    class Meta:
        model = District
        fields = "__all__"


class NeighborhoodSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True)
    district = DistrictShortSerializer(read_only=True)

    class Meta:
        model = Neighborhood
        fields = "__all__"


class ResidentialComplexSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True)
    district = DistrictShortSerializer(read_only=True)
    neighborhood = NeighborhoodShortSerializer(read_only=True)

    class Meta:
        model = ResidentialComplex
        fields = "__all__"

