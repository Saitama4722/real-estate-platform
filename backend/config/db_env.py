"""
Database resolution + startup guard.

⚠ WHY THIS MODULE EXISTS
------------------------
This machine carries a persistent **User-level Windows environment variable**
``DATABASE_URL`` that belongs to an unrelated local tool and points at its own
``mindmem`` database. ``load_dotenv()`` does NOT override variables that already
exist in the environment, so ``backend/.env`` lost that fight and Django silently
connected to the wrong database — the site showed no data while the real rows sat
untouched in ``real_estate_db``, and ``manage.py test`` announced it was creating
``test_mindmem``.

Reading a PROJECT-SPECIFIC name first makes that collision impossible:

    CENTREAL_DATABASE_URL   ← authoritative; set in backend/.env
    DATABASE_URL            ← fallback, so Railway/production keeps working
    POSTGRES_* parts        ← legacy fallback, unchanged

⚠ DO NOT "SIMPLIFY" THIS TO ``load_dotenv(override=True)``.
That was considered and rejected for a concrete reason: ``backend/Dockerfile``
does ``COPY . .`` and the repo has **no ``.dockerignore``**, so a developer's
local ``backend/.env`` is baked into any image built from a working tree. With
``override=True`` that file would then BEAT the platform-injected
``DJANGO_SECRET_KEY``, ``DATABASE_URL`` and R2 credentials in production —
pointing a deployed service at ``localhost:5432`` with a dev signing key.
``override=True`` is only safe there by the coincidence that ``.env`` is
gitignored, which is not a guarantee. It would also break the ordinary ability to
override one variable for one command, which is a normal debugging move.
"""
from __future__ import annotations

import os
import sys

#: Project-specific and therefore collision-proof. Checked FIRST.
CENTREAL_DB_URL_VAR = "CENTREAL_DATABASE_URL"
#: Standard name. Still honoured, so production (Railway) needs no change — but
#: it is also the name the ambient Windows variable uses, hence second place.
FALLBACK_DB_URL_VAR = "DATABASE_URL"

#: Override for the expected-name check (a second developer, another DB name).
EXPECTED_DB_NAME_VAR = "CENTREAL_EXPECTED_DB_NAME"
DEFAULT_EXPECTED_DB_NAME = "real_estate_db"


def resolve_database_url(*, is_deployed: bool = False) -> tuple[str, str]:
    """
    Return ``(url, source_variable_name)``; ``("", "")`` when neither is set.

    ⚠ THE PRECEDENCE FLIPS WHEN DEPLOYED, and that is not a detail — it is what
    keeps this mechanism from becoming the very hazard it was built to avoid.

      * local (default): ``CENTREAL_DATABASE_URL`` wins, so an ambient OS-level
        ``DATABASE_URL`` from another tool cannot shadow ``backend/.env``.
      * deployed: ``DATABASE_URL`` wins, because the PLATFORM is authoritative
        there. ``backend/Dockerfile`` does ``COPY . .`` with no ``.dockerignore``,
        so a developer's local ``.env`` can be baked into an image; without this
        flip, that file's ``CENTREAL_DATABASE_URL`` would silently outrank
        Railway's injected database and point production at ``localhost``.
        ``CENTREAL_DATABASE_URL`` is a LOCAL-DEVELOPMENT escape hatch only.
    """
    order = (
        (FALLBACK_DB_URL_VAR, CENTREAL_DB_URL_VAR)
        if is_deployed
        else (CENTREAL_DB_URL_VAR, FALLBACK_DB_URL_VAR)
    )
    for var in order:
        value = os.environ.get(var, "").strip()
        if value:
            return value, var
    return "", ""


def expected_db_name() -> str:
    """The database this checkout is supposed to talk to in local development."""
    return (
        os.environ.get(EXPECTED_DB_NAME_VAR, "").strip() or DEFAULT_EXPECTED_DB_NAME
    )


def _ambient_conflict() -> str:
    """The ambient DATABASE_URL, when it is NOT the one we ended up using."""
    if os.environ.get(CENTREAL_DB_URL_VAR, "").strip():
        return os.environ.get(FALLBACK_DB_URL_VAR, "").strip()
    return ""


def describe_connection(db: dict, source_var: str) -> str:
    """One-line summary of the database that has been resolved."""
    name = db.get("NAME") or "(unset)"
    user = db.get("USER") or "(unset)"
    host = db.get("HOST") or "(unset)"
    port = db.get("PORT") or ""
    where = f"{host}:{port}" if port else str(host)
    origin = source_var or "POSTGRES_* parts"
    return f"[Centreal] DB  NAME={name}  USER={user}  HOST={where}  (from {origin})"


def build_startup_report(
    db: dict,
    *,
    source_var: str,
    expected: str,
    is_deployed: bool,
    is_test_run: bool = False,
) -> tuple[str, str]:
    """
    Return ``(info_line, warning_block)``. ``warning_block`` is "" when fine.

    The warning is a wall of ``!`` on purpose. The failure being prevented is
    SILENT operation on the wrong data, so a subtle note would defeat the point —
    it has to be impossible to scroll past in the "Centreal Backend" window.
    """
    info = describe_connection(db, source_var)
    if is_test_run:
        info += "   (test run: Django will use test_<NAME>)"

    # In production the expected-name check is meaningless — the platform picks
    # the database, and it is legitimately not called real_estate_db.
    if is_deployed:
        return info, ""

    name = str(db.get("NAME") or "")
    if name == expected:
        conflict = _ambient_conflict()
        if conflict:
            info += (
                f"\n[Centreal] note: an ambient {FALLBACK_DB_URL_VAR} is set and was"
                f" IGNORED in favour of {CENTREAL_DB_URL_VAR}."
            )
        return info, ""

    lines = [
        "",
        "!" * 78,
        "!!  WRONG DATABASE — Centreal is NOT pointed at the expected local database.",
        "!" * 78,
        f"!!  expected NAME : {expected}",
        f"!!  resolved NAME : {name or '(unset)'}",
        f"!!  resolved from : {source_var or 'POSTGRES_* parts'}",
    ]
    ambient = os.environ.get(FALLBACK_DB_URL_VAR, "").strip()
    if source_var == FALLBACK_DB_URL_VAR and ambient:
        lines += [
            "!!",
            f"!!  An ambient OS-level {FALLBACK_DB_URL_VAR} is almost certainly shadowing",
            "!!  backend/.env — load_dotenv() never overrides an existing variable.",
            f"!!  FIX: set {CENTREAL_DB_URL_VAR} in backend/.env (it wins over"
            f" {FALLBACK_DB_URL_VAR}).",
        ]
    lines += [
        "!!",
        "!!  Reads will look like MISSING DATA and writes will land in the wrong",
        "!!  database. Stop and fix this before using the site.",
        "!" * 78,
        "",
    ]
    return info, "\n".join(lines)


def emit_startup_report(db: dict, *, source_var: str, is_deployed: bool) -> None:
    """
    Print the connection line, plus a loud banner when the name is unexpected.

    Written to **stderr** so it stays visible in the launcher window without
    corrupting the stdout of machine-readable commands (``dumpdata``,
    ``diffsettings``). Runs from ``CommonConfig.ready()``, so it covers
    ``runserver``, every management command, and the test runner alike.

    This reports the RESOLVED CONFIGURATION rather than opening a connection:
    ``ready()`` must not touch the database (it runs before migrations, during
    ``collectstatic``, and inside the test runner's setup). The configuration is
    what the connection will use, so naming it is equivalent — and it cannot
    itself fail.
    """
    is_test_run = "test" in sys.argv[1:2]
    info, warning = build_startup_report(
        db,
        source_var=source_var,
        expected=expected_db_name(),
        is_deployed=is_deployed,
        is_test_run=is_test_run,
    )
    print(info, file=sys.stderr, flush=True)
    if warning:
        print(warning, file=sys.stderr, flush=True)
