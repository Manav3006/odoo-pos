from flask import Flask

from .auth_routes import auth_bp
from .health_routes import health_bp
from .pos_routes import pos_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(pos_bp)
