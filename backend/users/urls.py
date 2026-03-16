"""
Auth URL routes.
"""
from django.urls import path

from . import views

app_name = "users"

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="login"),
    path("refresh/", views.RefreshView.as_view(), name="refresh"),
    path("me/", views.CurrentUserView.as_view(), name="me"),
]
