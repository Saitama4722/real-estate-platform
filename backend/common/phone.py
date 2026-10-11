"""
Canonical Russian phone normalisation.

ONE definition, for any value the SITE renders back to visitors and therefore
has to store in a single form.

⚠ Deliberately NOT applied to the three existing hand-rolled validators
(`leads.validate_client_phone`, `owners.validate_phone`,
`submissions.validate_owner_phone`). Those keep the raw string a person typed on
purpose — they record what a caller dictated, and rewriting it would destroy
information a realtor may need (an extension, a second number, a note). This
module is for the opposite case: a value the platform publishes.
"""
import re

# `+` only in the leading position; everything else is what a person types
# into a phone field (digits, brackets, dashes, spaces).
_ALLOWED_CHARS = re.compile(r"^\+?[0-9()\-\s]+$")
_NON_DIGITS = re.compile(r"\D")

#: Russian number stored as `+7` plus ten digits.
CANONICAL_PHONE_LEN = 12


def normalize_ru_phone(raw: str) -> str | None:
    """
    Accept the forms a person actually types and return the canonical
    ``+7XXXXXXXXXX``.

    Returns ``""`` for blank input — an intentionally cleared value is not an
    error, it is how the phone is removed from the header.

    Returns ``None`` when the value is not a Russian ten-digit number, so the
    caller can raise its own message.

    Accepted `[measured]` by ``AgencyPhoneNormalisationTests``:
    ``+79283330837``, ``8 928 333-08-37``, ``+7 (928) 333-08-37``,
    ``9283330837`` — all → ``+79283330837``.
    """
    s = (raw or "").strip()
    if not s:
        return ""
    if not _ALLOWED_CHARS.match(s):
        return None
    digits = _NON_DIGITS.sub("", s)
    # 8XXXXXXXXXX and 7XXXXXXXXXX are the same subscriber number.
    if len(digits) == 11 and digits[0] in ("7", "8"):
        digits = digits[1:]
    if len(digits) != 10:
        return None
    # Landlines (495, 812, 861…) are ten digits too, so the leading 9 of a
    # mobile number is NOT required — an agency may publish a landline.
    return f"+7{digits}"
