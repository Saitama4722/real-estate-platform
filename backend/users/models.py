"""
Custom user model: email as login, role-based access.
Realtor profile: staff profile for realtors (public-facing data).
"""
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models

from common.models import BaseTimestampedModel

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model with email as the unique login field."""

    class Role(models.TextChoices):
        SUPERADMIN = "superadmin", "Superadmin"
        ADMIN = "admin", "Admin"
        REALTOR = "realtor", "Realtor"

    email = models.EmailField("email", unique=True)
    phone = models.CharField("phone", max_length=32, blank=True)
    first_name = models.CharField("first name", max_length=150)
    last_name = models.CharField("last name", max_length=150)
    role = models.CharField(
        "role",
        max_length=20,
        choices=Role.choices,
        default=Role.REALTOR,
    )
    is_active = models.BooleanField("active", default=True)
    is_staff = models.BooleanField("staff status", default=False)
    date_joined = models.DateTimeField("date joined", auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"

    def __str__(self):
        return self.email

    # --- Role helpers (foundation for role-based access control) ---

    def has_role(self, role):
        """Return True if this user has the given role (compare by value)."""
        if isinstance(role, self.Role):
            role = role.value
        return self.role == role

    def has_any_role(self, roles):
        """Return True if this user has any of the given roles."""
        allowed = {
            r.value if isinstance(r, self.Role) else r for r in roles
        }
        return self.role in allowed

    @property
    def is_superadmin_role(self):
        return self.has_role(self.Role.SUPERADMIN)

    @property
    def is_admin_role(self):
        return self.has_role(self.Role.ADMIN)

    @property
    def is_realtor_role(self):
        return self.has_role(self.Role.REALTOR)

    @property
    def has_staff_level_access(self):
        """True for superadmin or admin (staff-level roles)."""
        return self.has_any_role((self.Role.SUPERADMIN, self.Role.ADMIN))


class RealtorProfile(BaseTimestampedModel):
    """
    Staff profile for realtors: public-facing data stored separately from auth.
    Conceptually belongs to a user with role=realtor.
    """

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="realtor_profile",
        verbose_name="user",
    )
    public_name = models.CharField("public name", max_length=255, blank=True)
    public_phone = models.CharField("public phone", max_length=32, blank=True)
    photo = models.ImageField(
        "photo",
        upload_to="realtors/photos/",
        blank=True,
        null=True,
    )
    short_bio = models.TextField("short bio", blank=True)
    is_public = models.BooleanField("is public", default=False)
    agency = models.ForeignKey(
        "agencies.Agency",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="realtor_profiles",
        verbose_name="agency",
    )

    class Meta:
        verbose_name = "realtor profile"
        verbose_name_plural = "realtor profiles"

    def __str__(self):
        return self.public_name or self.user.email

    def clean(self):
        super().clean()
        if self.user_id and self.user.role != User.Role.REALTOR:
            raise ValidationError(
                {"user": "Realtor profile should be linked to a user with role Realtor."}
            )
