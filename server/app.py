from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO

from db import DEFAULT_DB_PATH, ensure_schema, seed_demo_data
from routes import register_blueprints


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


socketio = SocketIO(async_mode="threading", cors_allowed_origins="*")


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.update(
        DB_PATH=os.getenv("DB_PATH", str(DEFAULT_DB_PATH)),
        JWT_SECRET=os.getenv("JWT_SECRET", "replace-me-in-production"),
        APP_HOST=os.getenv("APP_HOST", "0.0.0.0"),
        APP_PORT=int(os.getenv("APP_PORT", "5000")),
        CORS_ORIGINS=os.getenv("CORS_ORIGINS", "*").split(","),
    )

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    ensure_schema(app.config["DB_PATH"])
    seed_demo_data(app.config["DB_PATH"])

    register_blueprints(app)
    socketio.init_app(app)

    @app.get("/")
    def root() -> tuple[dict[str, str], int]:
        return {"message": "Odoo POS Cafe API"}, 200

    @app.errorhandler(404)
    def not_found(_error):  # type: ignore[no-untyped-def]
        return jsonify({"error": "Resource not found."}), 404

    @app.errorhandler(500)
    def internal_server_error(_error):  # type: ignore[no-untyped-def]
        return jsonify({"error": "Unexpected server error."}), 500

    return app


app = create_app()


if __name__ == "__main__":
    socketio.run(
        app,
        host=app.config["APP_HOST"],
        port=app.config["APP_PORT"],
        debug=True,
    )
