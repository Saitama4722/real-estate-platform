from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "users"
    verbose_name = "Пользователи"

    def ready(self):
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            if User.objects.filter(is_superuser=True).exists():
                return

            email = "admin@admin.com"
            password = "12345678"
            user, _created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": "Admin",
                    "last_name": "Admin",
                    "role": User.Role.SUPERADMIN,
                    "is_active": True,
                    "is_staff": True,
                    "is_superuser": True,
                },
            )
            user.is_active = True
            user.is_staff = True
            user.is_superuser = True
            user.role = User.Role.SUPERADMIN
            if not user.first_name:
                user.first_name = "Admin"
            if not user.last_name:
                user.last_name = "Admin"
            user.set_password(password)
            user.save()
        except Exception:
            pass
