"""
Custom user model: email as login, role-based access.
Realtor profile: staff profile for realtors (public-facing data).
"""
import re

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import IntegrityError, models

from common.image_compression import compress_avatar
from common.models import BaseTimestampedModel

from .managers import UserManager

_CRM_ID_PATTERN = re.compile(r"^RID(\d{6})$")


def _compress_avatar_field(field_file) -> None:
    """
    Compress an avatar ImageField in place to a 400x400 square JPEG (q85), but
    only when it holds a *new, uncommitted* upload — so re-saving a row that
    already has a stored avatar never re-processes the existing file.

    ``FieldFile._committed`` is False exactly while an unsaved upload is assigned;
    once written to storage it flips True. ``compress_avatar`` returns None when
    the image is already a square at the target size, leaving the upload as-is.
    """
    if not field_file:
        return
    if getattr(field_file, "_committed", True):
        return
    try:
        compressed = compress_avatar(field_file)
    except Exception:  # noqa: BLE001 — never let compression break the save
        return
    if compressed is not None:
        field_file.save(compressed.name, compressed, save=False)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model with email as the unique login field."""

    class Role(models.TextChoices):
        """Платформенные роли сотрудника. Полный доступ к CRM API: superadmin и admin; риэлтор — ограничен выборкой/объектными правами."""
        SUPERADMIN = "superadmin", "Суперадминистратор"
        ADMIN = "admin", "Администратор"
        REALTOR = "realtor", "Риэлтор"

    email = models.EmailField("Email", unique=True)
    phone = models.CharField("Телефон", max_length=32, blank=True)
    avatar = models.ImageField(
        "Аватар",
        upload_to="users/avatars/",
        blank=True,
        null=True,
    )
    crm_id = models.CharField(
        "CRM ID",
        max_length=10,
        unique=True,
        blank=False,
        db_index=True,
    )
    first_name = models.CharField("Имя", max_length=150)
    last_name = models.CharField("Фамилия", max_length=150)
    role = models.CharField(
        "Роль",
        max_length=20,
        choices=Role.choices,
        default=Role.REALTOR,
    )
    is_active = models.BooleanField("Активен", default=True)
    is_staff = models.BooleanField("Доступ в админку", default=False)
    date_joined = models.DateTimeField("Дата регистрации", auto_now_add=True)

    # Доп. права для роли «Риэлтор» в CRM (суперадмин/админ обходят через has_staff_level_access).
    perm_create_property = models.BooleanField(
        "CRM: создавать объекты",
        default=False,
    )
    perm_edit_property = models.BooleanField(
        "CRM: редактировать объекты",
        default=False,
    )
    perm_delete_property = models.BooleanField(
        "CRM: архивировать объекты",
        default=False,
    )
    perm_view_clients = models.BooleanField(
        "CRM: просматривать клиентов (лиды)",
        default=False,
    )
    perm_delete_clients = models.BooleanField(
        "CRM: удалять клиентов (лиды)",
        default=False,
    )
    perm_change_status = models.BooleanField(
        "CRM: менять статус лидов",
        default=False,
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self):
        return self.email

    @classmethod
    def allocate_next_crm_id(cls):
        """Next RID###### id from existing rows (best-effort; collisions retried in save)."""
        best = 0
        qs = cls.objects.exclude(crm_id="").values_list("crm_id", flat=True)
        for cid in qs:
            m = _CRM_ID_PATTERN.fullmatch(cid or "")
            if m:
                best = max(best, int(m.group(1)))
        return f"RID{best + 1:06d}"

    def save(self, *args, **kwargs):
        _compress_avatar_field(self.avatar)
        if self._state.adding and not self.crm_id:
            max_attempts = 12
            for attempt in range(max_attempts):
                self.crm_id = type(self).allocate_next_crm_id()
                try:
                    return super().save(*args, **kwargs)
                except IntegrityError:
                    if attempt >= max_attempts - 1:
                        raise
                    self.crm_id = ""
                    continue
        return super().save(*args, **kwargs)

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


class EmployeeActivityLog(models.Model):
    """Журнал входа и выхода сотрудников в личный кабинет / CRM."""

    class ActionType(models.TextChoices):
        LOGIN = "login", "Вход"
        LOGOUT = "logout", "Выход"

    user = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="activity_logs",
        verbose_name="Пользователь",
    )
    action_type = models.CharField(
        "Действие",
        max_length=16,
        choices=ActionType.choices,
        db_index=True,
    )
    created_at = models.DateTimeField("Дата и время", auto_now_add=True, db_index=True)
    ip_address = models.GenericIPAddressField(
        "IP-адрес",
        null=True,
        blank=True,
    )
    user_agent = models.TextField("User-Agent", blank=True)

    class Meta:
        verbose_name = "Запись активности сотрудника"
        verbose_name_plural = "Журнал активности сотрудников"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.user_id} {self.action_type} @ {self.created_at}"


class RealtorProfile(BaseTimestampedModel):
    """
    Staff profile for realtors: public-facing data stored separately from auth.
    Conceptually belongs to a user with role=realtor.
    """

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="realtor_profile",
        verbose_name="Пользователь",
    )
    public_name = models.CharField("Публичное имя", max_length=255, blank=True)
    public_phone = models.CharField("Публичный телефон", max_length=32, blank=True)
    photo = models.ImageField(
        "Фото",
        upload_to="realtors/photos/",
        blank=True,
        null=True,
    )
    short_bio = models.TextField("Краткая биография", blank=True)
    is_public = models.BooleanField("Показывать на сайте", default=False)
    agency = models.ForeignKey(
        "agencies.Agency",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="realtor_profiles",
        verbose_name="Агентство",
    )

    class Meta:
        verbose_name = "Профиль риэлтора"
        verbose_name_plural = "Профили риэлторов"

    def __str__(self):
        return self.public_name or self.user.email

    def clean(self):
        super().clean()
        if self.user_id and self.user.role != User.Role.REALTOR:
            raise ValidationError(
                {
                    "user": "Профиль риэлтора можно привязать только к пользователю с ролью «Риэлтор»."
                }
            )

    def save(self, *args, **kwargs):
        _compress_avatar_field(self.photo)
        return super().save(*args, **kwargs)
