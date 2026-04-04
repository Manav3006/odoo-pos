from __future__ import annotations

import sqlite3

from flask import Blueprint, current_app, jsonify, request

from auth import auth_required, create_access_token, hash_password, verify_password
from db import get_connection


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/signup")
def signup():
    payload = request.get_json(silent=True) or {}

    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    role = (payload.get("role") or "staff").strip().lower()
    allowed_roles = {"staff", "manager", "customer"}

    if not username or not email or len(password) < 6:
        return jsonify({"error": "username, email and password(>=6) are required."}), 400
    if role not in allowed_roles:
        return jsonify({"error": "Invalid role."}), 400

    db_path = current_app.config["DB_PATH"]
    password_hash = hash_password(password)

    try:
        with get_connection(db_path) as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (username, email, password_hash, role)
                VALUES (?, ?, ?, ?);
                """,
                (username, email, password_hash, role),
            )
            user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({"error": "User already exists."}), 409

    token = create_access_token(user_id=user_id, role=role)
    return (
        jsonify(
            {
                "token": token,
                "user": {
                    "id": user_id,
                    "username": username,
                    "email": email,
                    "role": role,
                },
            }
        ),
        201,
    )


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required."}), 400

    db_path = current_app.config["DB_PATH"]
    with get_connection(db_path) as connection:
        user = connection.execute(
            """
            SELECT id, username, email, password_hash, role
            FROM users
            WHERE email = ?;
            """,
            (email,),
        ).fetchone()

    if user is None or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid credentials."}), 401

    token = create_access_token(user_id=user["id"], role=user["role"])
    return jsonify(
        {
            "token": token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "role": user["role"],
            },
        }
    )


@auth_bp.get("/me")
@auth_required
def me():
    from flask import g

    db_path = current_app.config["DB_PATH"]
    user_id = g.current_user["user_id"]

    with get_connection(db_path) as connection:
        user = connection.execute(
            "SELECT id, username, email, role FROM users WHERE id = ?;",
            (user_id,),
        ).fetchone()

    if user is None:
        return jsonify({"error": "User not found."}), 404

    return jsonify(
        {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
        }
    )
