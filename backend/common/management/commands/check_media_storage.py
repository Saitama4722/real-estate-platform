"""
Read-only connectivity check for the R2 / S3 media bucket.

Proves the AWS_* credentials in backend/.env actually work WITHOUT uploading,
overwriting or deleting anything: it only calls HeadBucket and ListObjectsV2.

Runs regardless of MEDIA_STORAGE_BACKEND, so the credentials can be verified
while the site is still serving media from the local filesystem.

    python manage.py check_media_storage

Exit code 0 = the bucket is reachable with these credentials.
Exit code 1 = misconfiguration or a rejected request (the reason is printed).
"""
from __future__ import annotations

import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

# Env vars that must be present for the r2 / s3 backends. AWS_S3_ENDPOINT_URL is
# checked separately: it is required for r2 but omitted for real AWS S3.
REQUIRED_VARS = (
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_STORAGE_BUCKET_NAME",
)


def _mask(value: str) -> str:
    """Show enough of a secret to identify it, never enough to use it."""
    if not value:
        return "(empty)"
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}...{value[-4:]} ({len(value)} chars)"


class Command(BaseCommand):
    help = (
        "Verify the R2/S3 media bucket credentials are valid and the bucket is "
        "reachable. Read-only: performs no uploads, no writes, no deletes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--backend",
            choices=("r2", "s3"),
            default=None,
            help=(
                "Which cloud backend's settings to test. Defaults to the active "
                "MEDIA_STORAGE_BACKEND when it is r2/s3, otherwise r2."
            ),
        )
        parser.add_argument(
            "--sample",
            type=int,
            default=5,
            help="How many existing object keys to list as proof of read access (default 5).",
        )

    def handle(self, *args, **options):
        try:
            import boto3
            from botocore.client import Config
            from botocore.exceptions import BotoCoreError, ClientError
        except ImportError as exc:  # pragma: no cover - dependency is in requirements.txt
            raise CommandError(
                "boto3 is not installed in this environment. "
                "Run: pip install -r requirements.txt"
            ) from exc

        backend = options["backend"] or (
            settings.MEDIA_STORAGE_BACKEND
            if settings.MEDIA_STORAGE_BACKEND in ("r2", "s3")
            else "r2"
        )

        access_key = os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
        secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
        bucket = os.environ.get("AWS_STORAGE_BUCKET_NAME", "").strip()
        endpoint = os.environ.get("AWS_S3_ENDPOINT_URL", "").strip()
        region = os.environ.get("AWS_S3_REGION_NAME", "").strip() or "auto"
        custom_domain = os.environ.get("AWS_S3_CUSTOM_DOMAIN", "").strip()

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Configuration"))
        self.stdout.write(f"  backend under test      : {backend}")
        self.stdout.write(
            f"  MEDIA_STORAGE_BACKEND   : {settings.MEDIA_STORAGE_BACKEND} "
            f"(active storage; unaffected by this check)"
        )
        self.stdout.write(f"  AWS_STORAGE_BUCKET_NAME : {bucket or '(empty)'}")
        self.stdout.write(f"  AWS_S3_ENDPOINT_URL     : {endpoint or '(empty)'}")
        self.stdout.write(f"  AWS_S3_REGION_NAME      : {region}")
        self.stdout.write(f"  AWS_ACCESS_KEY_ID       : {_mask(access_key)}")
        self.stdout.write(f"  AWS_SECRET_ACCESS_KEY   : {_mask(secret_key)}")
        self.stdout.write(f"  AWS_S3_CUSTOM_DOMAIN    : {custom_domain or '(empty)'}")
        self.stdout.write("")

        # --- static validation, before touching the network ------------------
        problems: list[str] = []
        for var in REQUIRED_VARS:
            if not os.environ.get(var, "").strip():
                problems.append(f"{var} is empty.")

        if backend == "r2" and not endpoint:
            problems.append(
                "AWS_S3_ENDPOINT_URL is empty. R2 requires "
                "https://<account_id>.r2.cloudflarestorage.com"
            )
        if endpoint and not endpoint.startswith("https://"):
            problems.append(f"AWS_S3_ENDPOINT_URL should start with https:// (got {endpoint!r}).")
        if bucket and endpoint and f"/{bucket}" in endpoint:
            problems.append(
                "AWS_S3_ENDPOINT_URL must NOT contain the bucket name — it is the "
                "account-level endpoint only."
            )

        if problems:
            self.stdout.write(self.style.ERROR("Configuration is incomplete:"))
            for problem in problems:
                self.stdout.write(self.style.ERROR(f"  - {problem}"))
            raise CommandError("Nothing was sent to the bucket. Fix backend/.env and re-run.")

        # AWS_S3_CUSTOM_DOMAIN is required to SERVE media, but not to prove the
        # credentials work — so it is a warning here, not a failure.
        if not custom_domain:
            self.stdout.write(
                self.style.WARNING(
                    "  ! AWS_S3_CUSTOM_DOMAIN is empty. Credentials can still be verified, "
                    "but MEDIA_STORAGE_BACKEND=r2 will refuse to start until it is set."
                )
            )
        elif custom_domain.startswith("http"):
            self.stdout.write(
                self.style.WARNING(
                    "  ! AWS_S3_CUSTOM_DOMAIN must be a bare host (pub-xxx.r2.dev), "
                    "without the https:// prefix."
                )
            )

        # --- read-only calls -------------------------------------------------
        client_kwargs = {
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
            "region_name": region,
            "config": Config(
                signature_version=getattr(settings, "AWS_S3_SIGNATURE_VERSION", "s3v4"),
                s3={"addressing_style": getattr(settings, "AWS_S3_ADDRESSING_STYLE", "path")},
            ),
        }
        if endpoint:
            client_kwargs["endpoint_url"] = endpoint

        client = boto3.client("s3", **client_kwargs)

        self.stdout.write(self.style.MIGRATE_HEADING("Checks (read-only)"))

        try:
            client.head_bucket(Bucket=bucket)
        except ClientError as exc:
            code = str(exc.response.get("Error", {}).get("Code", "")).strip()
            status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            self.stdout.write(self.style.ERROR(f"  FAIL  HeadBucket {bucket} -> {code or status}"))
            raise CommandError(self._explain(code, status, bucket)) from exc
        except BotoCoreError as exc:
            self.stdout.write(self.style.ERROR(f"  FAIL  HeadBucket {bucket}"))
            raise CommandError(
                f"Could not reach {endpoint or 'the AWS S3 endpoint'}: {exc}. "
                "Check the endpoint URL and network access."
            ) from exc

        self.stdout.write(self.style.SUCCESS(f"  OK    HeadBucket — bucket '{bucket}' exists and is readable"))

        sample = max(0, int(options["sample"]))
        try:
            listing = client.list_objects_v2(Bucket=bucket, MaxKeys=max(sample, 1))
        except ClientError as exc:
            code = str(exc.response.get("Error", {}).get("Code", "")).strip()
            self.stdout.write(
                self.style.WARNING(
                    f"  WARN  ListObjectsV2 refused ({code}). The token can reach the bucket "
                    "but may lack list permission; uploads may still work."
                )
            )
        else:
            keys = [item["Key"] for item in listing.get("Contents", [])]
            total_hint = "0 (bucket is empty)" if not keys else f"at least {len(keys)}"
            self.stdout.write(
                self.style.SUCCESS(f"  OK    ListObjectsV2 — objects visible: {total_hint}")
            )
            for key in keys[:sample]:
                self.stdout.write(f"          {key}")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Credentials are valid and the bucket is reachable."))
        self.stdout.write("Nothing was uploaded, modified or deleted.")
        if custom_domain and not custom_domain.startswith("http"):
            self.stdout.write(
                f"Public URLs will be built as: https://{custom_domain}/<key>"
            )
        self.stdout.write("")
        self.stdout.write(
            "Next step: python manage.py migrate_media_to_r2   (dry run, uploads nothing)"
        )

    @staticmethod
    def _explain(code: str, status, bucket: str) -> str:
        if code in ("403", "AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch"):
            return (
                "Access denied. Either AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are wrong, "
                f"or the R2 API token is not scoped to the bucket '{bucket}'. "
                "Re-copy both values from the Cloudflare R2 token screen "
                "(the secret is shown only once)."
            )
        if code in ("404", "NoSuchBucket"):
            return (
                f"The credentials were accepted but bucket '{bucket}' does not exist at this "
                "endpoint. Check AWS_STORAGE_BUCKET_NAME and that AWS_S3_ENDPOINT_URL points "
                "at the right Cloudflare account."
            )
        return f"HeadBucket failed (code={code or 'unknown'}, http={status}). See the message above."
