"""Typed errors. Every error response is JSON: {"error": "<code>", "message": "..."}."""

from __future__ import annotations


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, headers: dict[str, str] | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers or {}

    def body(self) -> dict[str, str]:
        return {"error": self.code, "message": self.message}


def unauthorized() -> ApiError:
    return ApiError(401, "unauthorized", "Missing or invalid bearer token", {"WWW-Authenticate": "Bearer"})


def payload_too_large(limit_bytes: int) -> ApiError:
    return ApiError(413, "payload_too_large", f"File exceeds the {limit_bytes // (1024 * 1024)} MB limit")


def unsupported_media_type(expected: str) -> ApiError:
    return ApiError(415, "unsupported_media_type", f"Expected {expected}")
