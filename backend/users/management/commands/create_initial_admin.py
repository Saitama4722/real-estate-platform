import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand

EMAIL_VAR = "INITIAL_ADMIN_EMAIL"
PASSWORD_VAR = "INITIAL_ADMIN_PASSWORD"


class Command(BaseCommand):
    help = (
        "Create the initial superadmin from INITIAL_ADMIN_EMAIL / "
        "INITIAL_ADMIN_PASSWORD if no superuser exists "
        "(idempotent; safe to run on every deploy)."
    )

    # ⚠ This runs on EVERY container start (Dockerfile CMD) and the repo is
    # public. It must never create an account from credentials written in
    # code, and it must never fail the start: every "cannot create" path
    # warns and returns, so gunicorn still comes up.
    def handle(self, *args, **options):
        User = get_user_model()
        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write(
                "Superuser already exists; skipping initial admin creation."
            )
            return

        email = os.environ.get(EMAIL_VAR, "").strip()
        password = os.environ.get(PASSWORD_VAR, "")
        if not email or not password:
            self.stderr.write(
                self.style.WARNING(
                    f"No superadmin exists and {EMAIL_VAR} / {PASSWORD_VAR} "
                    "are not set — skipping admin creation."
                )
            )
            return

        # Validated against the unsaved user so UserAttributeSimilarityValidator
        # can compare the password with the email.
        candidate = User(email=email)
        try:
            validate_password(password, user=candidate)
        except ValidationError as exc:
            self.stderr.write(
                self.style.WARNING(
                    f"{PASSWORD_VAR} was rejected by the password validators — "
                    "skipping admin creation:"
                )
            )
            for message in exc.messages:
                self.stderr.write(f"  - {message}")
            return

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
