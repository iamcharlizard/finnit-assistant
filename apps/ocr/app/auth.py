"""Shared-token authentication (`Authorization: Bearer <OCR_SERVICE_TOKEN>`)."""

from __future__ import annotations

import hmac

from fastapi import Request

from .errors import unauthorized


def check_bearer(header: str | None, expected: str) -> bool:
    """Constant-time comparison of the bearer token against the expected one."""
    if not header:
        return False
    scheme, _, credentials = header.partition(" ")
    if scheme.lower() != "bearer" or not credentials:
        return False
    return hmac.compare_digest(credentials.strip().encode("utf-8"), expected.encode("utf-8"))


async def require_token(request: Request) -> None:
    """FastAPI dependency: rejects the request with 401 unless the token matches."""
    if not check_bearer(request.headers.get("authorization"), request.app.state.settings.token):
        raise unauthorized()
