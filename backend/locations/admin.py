from django.contrib import admin

from .models import City, District, Neighborhood, ResidentialComplex


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ["name", "region_name", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "sort_order"]
    list_filter = ["city"]
    ordering = ["city", "sort_order"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Neighborhood)
class NeighborhoodAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "district", "sort_order"]
    list_filter = ["city", "district"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(ResidentialComplex)
class ResidentialComplexAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "district", "neighborhood"]
    list_filter = ["city", "district"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}
