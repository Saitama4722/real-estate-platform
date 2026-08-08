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
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

#: Claim name. Short on purpose: it rides in every request's Authorization header.
TOKEN_VERSION_CLAIM = "tv"


class VersionedJWTAuthentication(JWTAuthentication):
    """Reject a token whose `tv` claim is behind the user's token_version."""

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
