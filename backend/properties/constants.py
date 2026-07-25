"""Product-rule constants for the properties app.

Kept in one module so the values below have exactly one definition. Import them
rather than repeating the literal — a second copy is how these silently drift.
"""

#: How long after `published_at` a listing still counts as "new".
#:
#: `is_new` is DERIVED from this window on every read (a serializer method over
#: `published_at`) — there is deliberately **no** model field and no stored flag,
#: so there is nothing to go stale, nothing to back-fill, and nothing an admin
#: has to remember to clear. Changing this number re-classifies every listing
#: immediately.
NEW_LISTING_WINDOW_DAYS = 14
