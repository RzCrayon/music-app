import os
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")

_client = None

def get_client():
    """Lazily build a single shared boto3 client (cheap to reuse, avoid
    reconnecting per-call)."""
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
            region_name="auto",  # R2 doesn't use AWS regions, but boto3 wants something
        )
    return _client


def upload_fileobj(file_obj, key, content_type=None):
    """Stream a werkzeug FileStorage (or any file-like object) straight to
    R2 without writing it to local disk first. Used by /api/songs/preview
    for the raw sheet-music upload."""
    extra_args = {"ContentType": content_type} if content_type else {}
    get_client().upload_fileobj(file_obj, R2_BUCKET_NAME, key, ExtraArgs=extra_args)
    return key


def upload_file(local_path, key, content_type=None):
    """Upload a local file (e.g. a rendered MIDI/mp3 the worker produced)."""
    extra_args = {"ContentType": content_type} if content_type else {}
    get_client().upload_file(local_path, R2_BUCKET_NAME, key, ExtraArgs=extra_args)
    return key


def download_file(key, local_path):
    """Pull an object down to local disk so a library that needs a real
    file path (Audiveris, fluidsynth) can work with it."""
    get_client().download_file(R2_BUCKET_NAME, key, local_path)
    return local_path


def delete_object(key):
    try:
        get_client().delete_object(Bucket=R2_BUCKET_NAME, Key=key)
    except ClientError as e:
        print(f"[R2] Failed to delete {key}: {e}")


def generate_presigned_url(key, expires_in=3600):
    """R2 buckets should stay private — generate short-lived signed URLs
    for the frontend to fetch audio/images rather than making the bucket
    public. expires_in is in seconds (default 1 hour)."""
    if not key:
        return None
    try:
        return get_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": R2_BUCKET_NAME, "Key": key},
            ExpiresIn=expires_in,
        )
    except ClientError as e:
        print(f"[R2] Failed to presign {key}: {e}")
        return None