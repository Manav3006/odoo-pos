from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = (
    Path.home() / ".local" / "share" / "odoo-pos" / "odoo_pos.db"
)
SCHEMA_PATH = BASE_DIR / "schema.sql"


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    path = db_path or str(DEFAULT_DB_PATH)
    Path(path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON;")
    return connection


def ensure_schema(db_path: str | None = None) -> None:
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with get_connection(db_path) as connection:
        orders_table = connection.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name = 'orders'
            LIMIT 1;
            """
        ).fetchone()
        if orders_table is not None:
            order_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(orders);").fetchall()
            }
            if "customer_id" not in order_columns:
                connection.execute(
                    "ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES users(id);"
                )

        connection.executescript(schema_sql)
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);"
        )


def seed_demo_data(db_path: str | None = None) -> None:
    """Seed basic records for local development and demo flows."""
    with get_connection(db_path) as connection:
        categories = ["Artisan Brews", "Pastries", "Mains"]
        for category in categories:
            connection.execute(
                "INSERT OR IGNORE INTO categories (name) VALUES (?);",
                (category,),
            )

        products: list[tuple[str, str, float, str, float, str]] = [
            (
                "Pour Over Coffee",
                "Artisan Brews",
                180.0,
                "cup",
                5.0,
                "Single origin hand-brewed coffee.",
            ),
            (
                "Cold Brew",
                "Artisan Brews",
                220.0,
                "glass",
                5.0,
                "Slow-steeped overnight with citrus notes.",
            ),
            (
                "Sourdough Sandwich",
                "Mains",
                320.0,
                "plate",
                5.0,
                "Toasted sourdough with seasonal filling.",
            ),
            (
                "Almond Croissant",
                "Pastries",
                160.0,
                "piece",
                5.0,
                "Buttery croissant with almond cream.",
            ),
        ]
        for product in products:
            name, category_name, price, unit, tax_rate, description = product
            connection.execute(
                """
                INSERT OR IGNORE INTO products (
                    name,
                    category_id,
                    price,
                    unit,
                    tax_rate,
                    description
                )
                VALUES (
                    ?,
                    (SELECT id FROM categories WHERE name = ?),
                    ?,
                    ?,
                    ?,
                    ?
                );
                """,
                (name, category_name, price, unit, tax_rate, description),
            )

        payment_methods = [
            ("Cash", "CASH", 1, None),
            ("Digital", "DIGITAL", 1, None),
            ("UPI QR", "UPI", 1, "123@ybl.com"),
        ]
        for method in payment_methods:
            connection.execute(
                """
                INSERT OR IGNORE INTO payment_methods (
                    name,
                    method_type,
                    is_enabled,
                    upi_id
                )
                VALUES (?, ?, ?, ?);
                """,
                method,
            )

        connection.execute(
            "INSERT OR IGNORE INTO floors (name) VALUES ('Ground Floor');"
        )

        tables = [("T3", 4), ("T6", 4), ("T8", 2), ("T10", 6)]
        for table_number, seats in tables:
            connection.execute(
                """
                INSERT OR IGNORE INTO tables (
                    floor_id,
                    table_number,
                    seats,
                    is_active
                )
                VALUES (
                    (SELECT id FROM floors WHERE name = 'Ground Floor'),
                    ?,
                    ?,
                    1
                );
                """,
                (table_number, seats),
            )


def fetch_all(
    query: str,
    params: tuple[Any, ...] = (),
    db_path: str | None = None,
) -> list[sqlite3.Row]:
    with get_connection(db_path) as connection:
        rows = connection.execute(query, params).fetchall()
    return rows


def fetch_one(
    query: str,
    params: tuple[Any, ...] = (),
    db_path: str | None = None,
) -> sqlite3.Row | None:
    with get_connection(db_path) as connection:
        row = connection.execute(query, params).fetchone()
    return row
