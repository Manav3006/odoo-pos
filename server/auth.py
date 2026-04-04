from __future__ import annotations

from datetime import UTC, datetime, timedelta
from functools import wraps
from typing import Any, Callable

import jwt
from flask import current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash


AuthCallable = Callable[..., Any]


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, password)


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=8)).timestamp()),
    }
    secret = current_app.config["JWT_SECRET"]
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    secret = current_app.config["JWT_SECRET"]
    payload = jwt.decode(token, secret, algorithms=["HS256"])
    return payload


def auth_required(func: AuthCallable) -> AuthCallable:
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing bearer token."}), 401

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return jsonify({"error": "Missing bearer token."}), 401

        try:
            payload = decode_access_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid access token."}), 401

        g.current_user = {
            "user_id": int(payload["sub"]),
            "role": payload.get("role", "staff"),
        }
        return func(*args, **kwargs)

    return wrapper
