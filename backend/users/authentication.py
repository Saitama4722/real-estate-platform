"""
JWT authentication that honours `User.token_version`.

WHY THIS EXISTS. JWTs are stateless: once issued, simplejwt will accept an
access token until it expires (60 min here) and a refresh token for 7 days,
no matter what happens to the account in between. Changing a password does
NOT invalidate them. simplejwt's token_blacklist app can revoke a REFRESH
token, but the access token still works for up to an hour — too long for
"a compromised session must not survive a password reset".

So every token carries a `tv` claim holding the user's `token_version` at
issue time. A superadmin password reset bumps that counter, and the very next
request made with any older token fails here. Window of survival: zero.

COST, stated plainly: this runs on EVERY authenticated request. It adds no
query — the user row is already fetched by simplejwt's own `get_user` — just
an integer comparison. Keep it that cheap.
"""
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

#: Claim name. Short on purpose: it rides in every request's Authorization header.
TOKEN_VERSION_CLAIM = "tv"

class PasswordChangeRequired(PermissionDenied):
    """
    403 whose BODY carries a machine-readable code.

    DRF's `code=` argument sets the exception's code but does not put it in the
    response payload, so the client could not tell this apart from an ordinary
    permission denial `[measured]`. Passing a dict as `detail` makes DRF render
    exactly that dict.
    """

    def __init__(self):
        super().__init__(
            {
                "detail": "Сначала задайте новый пароль.",
                "code": "password_change_required",
            }
        )


#: The only paths reachable while `must_change_password` is set — precisely the
#: ones needed to GET OUT of that state. Everything else in the CRM is refused.
PASSWORD_CHANGE_EXEMPT_PATHS = frozenset(
    {
        "/api/auth/me/",              # so the client can read the flag
        "/api/auth/logout/",          # never trap someone in the app
        "/api/auth/password/change/",  # the way out
    }
)


class VersionedJWTAuthentication(JWTAuthentication):
    """
    Reject a token whose `tv` claim is behind the user's token_version, and
    refuse the whole CRM while `must_change_password` is set.

    ⚠ WHY THE PASSWORD-CHANGE GATE LIVES HERE AND NOT IN A PERMISSION CLASS.
    DRF REPLACES DEFAULT_PERMISSION_CLASSES whenever a view declares its own,
    and 31 views across 10 files declare theirs — so a "CRM-wide" permission
    would really mean 31 edits, and one missed view is a silent hole. Exactly
    one view overrides `authentication_classes` (a public homepage endpoint
    with no user), so THIS is the one place every authenticated CRM request
    must pass through. Enforcing here cannot be forgotten by a new view.

    It raises PermissionDenied (403), not an auth error (401): the caller IS
    authenticated — they are simply not allowed to do anything else yet. A 401
    would make the client log them out and lose the flow.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, _token = result
        if getattr(user, "must_change_password", False):
            if request.path not in PASSWORD_CHANGE_EXEMPT_PATHS:
                raise PasswordChangeRequired()
        return result

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        # Absent claim == issued before this feature shipped. Treat as
        # generation 0 so existing sessions keep working through the deploy,
        # rather than logging everyone out on release.
        claimed = validated_token.get(TOKEN_VERSION_CLAIM, 0)
        current = getattr(user, "token_version", 0)
        try:
            claimed = int(claimed)
        except (TypeError, ValueError):
            raise InvalidToken("Некорректный токен. Войдите заново.")
        if claimed != current:
            raise InvalidToken(
                "Сессия завершена: пароль был изменён. Войдите заново."
            )
        return user
