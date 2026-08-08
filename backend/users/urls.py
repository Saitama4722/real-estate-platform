"""
Auth URL routes.
"""
from django.urls import path

from . import views

app_name = "users"

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("refresh/", views.RefreshView.as_view(), name="refresh"),
    path("me/", views.CurrentUserView.as_view(), name="me"),
    # Отдельная ручка, а не поле в PATCH /me/: смена логина требует пароля и
    # пишется в журнал, и мешать это с правкой имени и телефона не стоит.
    path("me/email/", views.ChangeOwnEmailView.as_view(), name="me-email"),
]
