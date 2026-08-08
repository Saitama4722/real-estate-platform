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
    # ⚠ Этот путь перечислен в PASSWORD_CHANGE_EXEMPT_PATHS
    # (users/authentication.py) — менять его нужно в обоих местах, иначе
    # сотрудник с флагом must_change_password окажется заперт.
    path(
        "password/change/",
        views.ChangeOwnPasswordView.as_view(),
        name="password-change",
    ),
    path(
        "security-summary/",
        views.SecuritySummaryView.as_view(),
        name="security-summary",
    ),
]
