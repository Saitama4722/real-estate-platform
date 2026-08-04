"""
Signals for the users app.

Wired in `UsersConfig.ready()` — the same pattern the properties app uses for
its price-history signal.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import DEFAULT_REALTOR_BIO, RealtorProfile, User


@receiver(post_save, sender=User, dispatch_uid="users.create_realtor_profile")
def create_realtor_profile(sender, instance, created, **kwargs):
    """
    Give every newly created realtor a profile row carrying the default bio.

    WHY A SIGNAL AND NOT THE CRM ENDPOINT. Realtors are created through at
    least three paths — the CRM staff panel, Django admin, and the shell (plus
    fixtures and any future import) — and the requirement is that EVERY new
    realtor gets the template. A hook on the CRM serializer would cover one of
    them and silently miss the rest.

    Profiles used to be created lazily on first edit, so a realtor could exist
    with no row at all. That now only applies to rows predating this signal.

    `is_public` keeps its model default of False: a new realtor is a draft
    until the superadmin has tailored the bio and published them. Nothing here
    touches an existing profile — the bio is a starting point, never a
    reset, so re-saving a user cannot overwrite edited copy.
    """
    if not created or instance.role != User.Role.REALTOR:
        return
    RealtorProfile.objects.get_or_create(
        user=instance,
        defaults={"short_bio": DEFAULT_REALTOR_BIO},
    )
