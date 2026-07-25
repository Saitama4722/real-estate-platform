from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CityViewSet,
    DistrictGuidePublicViewSet,
    DistrictViewSet,
    NeighborhoodViewSet,
    ResidentialComplexViewSet,
    choices_view,
)

router = DefaultRouter()
router.register("cities", CityViewSet, basename="city")
router.register("districts", DistrictViewSet, basename="district")
router.register("neighborhoods", NeighborhoodViewSet, basename="neighborhood")
router.register("district-guides", DistrictGuidePublicViewSet, basename="district-guide")
router.register(
    "residential-complexes",
    ResidentialComplexViewSet,
    basename="residential-complex",
)

urlpatterns = [
    path("choices/", choices_view.as_view(), name="choices"),
]

urlpatterns += router.urls

