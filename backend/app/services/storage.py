"""
Storage Service
===============
Interface-based file storage. LocalStorageBackend saves files to a local /uploads
directory. Swap for S3StorageBackend in production by changing STORAGE_BACKEND.
"""
import os
import uuid
from pathlib import Path
from typing import Protocol

from fastapi import UploadFile


class StorageBackend(Protocol):
    async def save(self, file: UploadFile, subfolder: str = "") -> str:
        """Persist the file and return a retrievable URL/path."""
        ...

    def get_path(self, file_url: str) -> Path:
        """Resolve a stored file_url to a local filesystem path for streaming."""
        ...


class LocalStorageBackend:
    """Saves files under <project_root>/uploads/<subfolder>/<uuid>_<filename>."""

    def __init__(self, base_dir: str | None = None):
        if base_dir is None:
            # Resolve relative to this file: backend/app/services/ → backend/uploads/
            base_dir = str(Path(__file__).resolve().parent.parent.parent / "uploads")
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, file: UploadFile, subfolder: str = "") -> str:
        target_dir = self.base_dir / subfolder if subfolder else self.base_dir
        target_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(file.filename or "file").suffix
        filename = f"{uuid.uuid4().hex}{ext}"
        dest = target_dir / filename

        content = await file.read()
        dest.write_bytes(content)

        # Return a relative URL path served by the /uploads static mount
        rel = dest.relative_to(self.base_dir)
        return f"/uploads/{rel.as_posix()}"

    def get_path(self, file_url: str) -> Path:
        # Strip leading /uploads/
        rel = file_url.lstrip("/").removeprefix("uploads/")
        return self.base_dir / rel


# Singleton — swap this for S3StorageBackend() in production
storage: LocalStorageBackend = LocalStorageBackend()
