from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Create the initial platform superuser if none exists "
        "(idempotent; safe to run on every deploy)."
    )

    def handle(self, *args, **options):
        User = get_user_model()
        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write(
                "Superuser already exists; skipping initial admin creation."
            )
            return

        email = "admin@admin.com"
        password = "12345678"
        user, created = User.objects.get_or_create(
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

        if created:
            self.stdout.write(self.style.SUCCESS(f"Created initial admin: {email}"))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Existing user {email} elevated to superadmin; password reset."
                )
            )
