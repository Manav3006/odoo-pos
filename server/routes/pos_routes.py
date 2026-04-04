from __future__ import annotations

import base64
from io import BytesIO
from datetime import UTC, datetime
from typing import Any

from flask import Blueprint, current_app, g, jsonify, request

from auth import auth_required
from db import get_connection


pos_bp = Blueprint("pos", __name__, url_prefix="/api")


def _row_to_dict(row: Any) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def _emit_customer_event(event_name: str, payload: dict[str, Any]) -> None:
    socketio = current_app.extensions.get("socketio")
    if socketio is not None:
        socketio.emit(event_name, payload, namespace="/customer")


@pos_bp.get("/products")
@auth_required
def list_products():
    db_path = current_app.config["DB_PATH"]
    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT p.id, p.name, c.name AS category, p.price, p.unit, p.tax_rate, p.description
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            ORDER BY c.name, p.name;
            """
        ).fetchall()

    return jsonify([_row_to_dict(row) for row in rows])


@pos_bp.get("/floors")
@auth_required
def list_floors_with_tables():
    db_path = current_app.config["DB_PATH"]
    with get_connection(db_path) as connection:
        floors = connection.execute(
            "SELECT id, name FROM floors ORDER BY id;"
        ).fetchall()

        output = []
        for floor in floors:
            tables = connection.execute(
                """
                SELECT id, table_number, seats, is_active
                FROM tables
                WHERE floor_id = ?
                ORDER BY table_number;
                """,
                (floor["id"],),
            ).fetchall()
            output.append(
                {
                    "id": floor["id"],
                    "name": floor["name"],
                    "tables": [
                        {
                            "id": table["id"],
                            "table_number": table["table_number"],
                            "seats": table["seats"],
                            "is_active": bool(table["is_active"]),
                        }
                        for table in tables
                    ],
                }
            )

    return jsonify(output)


@pos_bp.get("/payment-methods")
@auth_required
def list_payment_methods():
    db_path = current_app.config["DB_PATH"]
    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT id, name, method_type, is_enabled, upi_id
            FROM payment_methods
            ORDER BY id;
            """
        ).fetchall()

    return jsonify(
        [
            {
                "id": row["id"],
                "name": row["name"],
                "method_type": row["method_type"],
                "is_enabled": bool(row["is_enabled"]),
                "upi_id": row["upi_id"],
            }
            for row in rows
        ]
    )


@pos_bp.post("/sessions/open")
@auth_required
def open_session():
    payload = request.get_json(silent=True) or {}
    opening_balance = float(payload.get("opening_balance") or 0)
    terminal_name = (payload.get("terminal_name") or "Main Register").strip()
    user_id = int(g.current_user["user_id"])
    now = datetime.now(UTC).isoformat()

    db_path = current_app.config["DB_PATH"]
    with get_connection(db_path) as connection:
        terminal = connection.execute(
            """
            SELECT id
            FROM terminals
            WHERE name = ?
            LIMIT 1;
            """,
            (terminal_name,),
        ).fetchone()

        if terminal is None:
            terminal_id = connection.execute(
                "INSERT INTO terminals (name, is_active) VALUES (?, 1);",
                (terminal_name,),
            ).lastrowid
        else:
            terminal_id = terminal["id"]

        active = connection.execute(
            """
            SELECT id, opened_at
            FROM pos_sessions
            WHERE terminal_id = ? AND closed_at IS NULL
            LIMIT 1;
            """,
            (terminal_id,),
        ).fetchone()
        if active is not None:
            return (
                jsonify(
                    {
                        "error": "Session already active for this terminal.",
                        "session_id": active["id"],
                        "opened_at": active["opened_at"],
                    }
                ),
                409,
            )

        session_id = connection.execute(
            """
            INSERT INTO pos_sessions (
                terminal_id,
                opened_by,
                opened_at,
                opening_balance,
                status
            )
            VALUES (?, ?, ?, ?, 'OPEN');
            """,
            (terminal_id, user_id, now, opening_balance),
        ).lastrowid

    return (
        jsonify(
            {
                "session_id": session_id,
                "terminal_name": terminal_name,
                "opened_at": now,
                "opening_balance": opening_balance,
            }
        ),
        201,
    )


@pos_bp.post("/sessions/<int:session_id>/close")
@auth_required
def close_session(session_id: int):
    payload = request.get_json(silent=True) or {}
    closing_balance = float(payload.get("closing_balance") or 0)
    now = datetime.now(UTC).isoformat()

    db_path = current_app.config["DB_PATH"]
    with get_connection(db_path) as connection:
        session = connection.execute(
            "SELECT id, status FROM pos_sessions WHERE id = ?;",
            (session_id,),
        ).fetchone()
        if session is None:
            return jsonify({"error": "Session not found."}), 404
        if session["status"] != "OPEN":
            return jsonify({"error": "Session is already closed."}), 409

        totals = connection.execute(
            """
            SELECT COALESCE(SUM(total_amount), 0) AS total_sales
            FROM orders
            WHERE session_id = ? AND order_status = 'PAID';
            """,
            (session_id,),
        ).fetchone()

        connection.execute(
            """
            UPDATE pos_sessions
            SET closed_at = ?,
                closing_balance = ?,
                closing_sales = ?,
                status = 'CLOSED'
            WHERE id = ?;
            """,
            (now, closing_balance, totals["total_sales"], session_id),
        )

    return jsonify(
        {
            "session_id": session_id,
            "closed_at": now,
            "closing_balance": closing_balance,
            "closing_sales": totals["total_sales"],
        }
    )


@pos_bp.post("/orders")
@auth_required
def create_order():
    payload = request.get_json(silent=True) or {}
    session_id = payload.get("session_id")
    table_id = payload.get("table_id")
    items = payload.get("items") or []

    if not session_id or not table_id or not items:
        return jsonify({"error": "session_id, table_id and items are required."}), 400

    db_path = current_app.config["DB_PATH"]
    now = datetime.now(UTC).isoformat()

    with get_connection(db_path) as connection:
        session = connection.execute(
            "SELECT id FROM pos_sessions WHERE id = ? AND status = 'OPEN';",
            (session_id,),
        ).fetchone()
        if session is None:
            return jsonify({"error": "Active session not found."}), 400

        table = connection.execute(
            "SELECT id, is_active FROM tables WHERE id = ?;",
            (table_id,),
        ).fetchone()
        if table is None or not table["is_active"]:
            return jsonify({"error": "Table not available."}), 400

        day_stamp = datetime.now(UTC).strftime("%Y%m%d")
        order_count = connection.execute(
            "SELECT COUNT(*) AS count_for_day FROM orders WHERE order_number LIKE ?;",
            (f"ORD-{day_stamp}-%",),
        ).fetchone()["count_for_day"]
        order_number = f"ORD-{day_stamp}-{order_count + 1:04d}"

        subtotal = 0.0
        total_tax = 0.0
        expanded_items: list[dict[str, Any]] = []
        for item in items:
            product_id = int(item.get("product_id") or 0)
            quantity = int(item.get("quantity") or 0)
            if product_id <= 0 or quantity <= 0:
                return jsonify({"error": "Invalid product_id or quantity."}), 400

            product = connection.execute(
                """
                SELECT id, name, price, tax_rate
                FROM products
                WHERE id = ?;
                """,
                (product_id,),
            ).fetchone()
            if product is None:
                return jsonify({"error": f"Product {product_id} not found."}), 404

            line_subtotal = float(product["price"]) * quantity
            line_tax = line_subtotal * (float(product["tax_rate"]) / 100.0)
            subtotal += line_subtotal
            total_tax += line_tax
            expanded_items.append(
                {
                    "product_id": product["id"],
                    "product_name": product["name"],
                    "quantity": quantity,
                    "unit_price": float(product["price"]),
                    "line_subtotal": round(line_subtotal, 2),
                    "line_tax": round(line_tax, 2),
                }
            )

        total_amount = round(subtotal + total_tax, 2)

        order_id = connection.execute(
            """
            INSERT INTO orders (
                order_number,
                session_id,
                table_id,
                created_at,
                order_status,
                subtotal,
                tax_total,
                total_amount
            )
            VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?);
            """,
            (order_number, session_id, table_id, now, subtotal, total_tax, total_amount),
        ).lastrowid

        for item in expanded_items:
            connection.execute(
                """
                INSERT INTO order_items (
                    order_id,
                    product_id,
                    quantity,
                    unit_price,
                    line_subtotal,
                    line_tax
                )
                VALUES (?, ?, ?, ?, ?, ?);
                """,
                (
                    order_id,
                    item["product_id"],
                    item["quantity"],
                    item["unit_price"],
                    item["line_subtotal"],
                    item["line_tax"],
                ),
            )

    return (
        jsonify(
            {
                "order_id": order_id,
                "order_number": order_number,
                "order_status": "DRAFT",
                "subtotal": round(subtotal, 2),
                "tax_total": round(total_tax, 2),
                "total_amount": total_amount,
                "items": expanded_items,
            }
        ),
        201,
    )


@pos_bp.post("/orders/<int:order_id>/send-kitchen")
@auth_required
def send_order_to_kitchen(order_id: int):
    now = datetime.now(UTC).isoformat()
    db_path = current_app.config["DB_PATH"]

    with get_connection(db_path) as connection:
        order = connection.execute(
            """
            SELECT id, order_number, table_id, order_status
            FROM orders
            WHERE id = ?;
            """,
            (order_id,),
        ).fetchone()
        if order is None:
            return jsonify({"error": "Order not found."}), 404

        if order["order_status"] not in {"DRAFT", "SENT_TO_KITCHEN"}:
            return jsonify({"error": "Order cannot be sent to kitchen."}), 409

        table = connection.execute(
            "SELECT table_number FROM tables WHERE id = ?;",
            (order["table_id"],),
        ).fetchone()

        line_items = connection.execute(
            """
            SELECT oi.product_id, p.name, oi.quantity
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = ?;
            """,
            (order_id,),
        ).fetchall()

        ticket_id = connection.execute(
            """
            INSERT INTO kitchen_tickets (
                order_id,
                ticket_status,
                created_at,
                updated_at
            )
            VALUES (?, 'TO_COOK', ?, ?);
            """,
            (order_id, now, now),
        ).lastrowid

        connection.execute(
            "UPDATE orders SET order_status = 'SENT_TO_KITCHEN' WHERE id = ?;",
            (order_id,),
        )

    event_payload = {
        "ticket_id": ticket_id,
        "order_id": order_id,
        "order_number": order["order_number"],
        "table_number": table["table_number"] if table else "-",
        "ticket_status": "TO_COOK",
        "items": [
            {
                "product_id": item["product_id"],
                "product_name": item["name"],
                "quantity": item["quantity"],
            }
            for item in line_items
        ],
        "created_at": now,
    }

    socketio = current_app.extensions.get("socketio")
    if socketio is not None:
        socketio.emit("kitchen:ticket_created", event_payload, namespace="/kitchen")

    return jsonify(event_payload), 201


@pos_bp.post("/orders/<int:order_id>/payments/upi-qr")
@auth_required
def generate_upi_qr(order_id: int):
    try:
        import qrcode
    except ModuleNotFoundError:
        return (
            jsonify(
                {
                    "error": "UPI QR dependency missing. Install with: pip install qrcode Pillow"
                }
            ),
            500,
        )

    now = datetime.now(UTC).isoformat()
    db_path = current_app.config["DB_PATH"]

    with get_connection(db_path) as connection:
        order = connection.execute(
            """
            SELECT id, order_number, order_status, total_amount
            FROM orders
            WHERE id = ?;
            """,
            (order_id,),
        ).fetchone()
        if order is None:
            return jsonify({"error": "Order not found."}), 404
        if order["order_status"] == "PAID":
            return jsonify({"error": "Order is already paid."}), 409

        method = connection.execute(
            """
            SELECT id, name, upi_id
            FROM payment_methods
            WHERE method_type = 'UPI' AND is_enabled = 1
            LIMIT 1;
            """
        ).fetchone()
        if method is None or not method["upi_id"]:
            return jsonify({"error": "UPI payment method is not configured."}), 400

        amount = round(float(order["total_amount"]), 2)
        upi_uri = (
            f"upi://pay?pa={method['upi_id']}&pn=Odoo%20POS%20Cafe"
            f"&am={amount:.2f}&cu=INR&tn={order['order_number']}"
        )

        qr = qrcode.QRCode(version=1, box_size=6, border=2)
        qr.add_data(upi_uri)
        qr.make(fit=True)
        image = qr.make_image(fill_color="#17310f", back_color="white")
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        qr_image_data_url = (
            "data:image/png;base64,"
            + base64.b64encode(buffer.getvalue()).decode("ascii")
        )

        payment_id = connection.execute(
            """
            INSERT INTO payments (
                order_id,
                payment_method_id,
                amount,
                payment_status,
                reference_code,
                created_at
            )
            VALUES (?, ?, ?, 'PENDING', ?, ?);
            """,
            (order_id, method["id"], amount, f"UPI_PENDING_{order['order_number']}", now),
        ).lastrowid

    return jsonify(
        {
            "payment_id": payment_id,
            "order_id": order_id,
            "order_number": order["order_number"],
            "amount": amount,
            "method": {
                "id": method["id"],
                "name": method["name"],
                "upi_id": method["upi_id"],
            },
            "upi_uri": upi_uri,
            "qr_image_data_url": qr_image_data_url,
        }
    )


@pos_bp.post("/orders/<int:order_id>/payments/confirm")
@auth_required
def confirm_payment(order_id: int):
    payload = request.get_json(silent=True) or {}
    payment_id = payload.get("payment_id")
    payment_method_id = payload.get("payment_method_id")
    reference_code = (payload.get("reference_code") or "").strip()
    now = datetime.now(UTC).isoformat()
    db_path = current_app.config["DB_PATH"]
    changed_by = int(g.current_user["user_id"])

    with get_connection(db_path) as connection:
        order = connection.execute(
            """
            SELECT id, order_number, order_status, total_amount
            FROM orders
            WHERE id = ?;
            """,
            (order_id,),
        ).fetchone()
        if order is None:
            return jsonify({"error": "Order not found."}), 404
        if order["order_status"] == "PAID":
            return jsonify({"error": "Order is already paid."}), 409

        selected_payment = None
        selected_method = None

        if payment_id is not None:
            selected_payment = connection.execute(
                """
                SELECT id, payment_method_id, amount, payment_status
                FROM payments
                WHERE id = ? AND order_id = ?;
                """,
                (payment_id, order_id),
            ).fetchone()
            if selected_payment is None:
                return jsonify({"error": "Payment record not found for this order."}), 404

            selected_method = connection.execute(
                """
                SELECT id, name, method_type, is_enabled
                FROM payment_methods
                WHERE id = ?;
                """,
                (selected_payment["payment_method_id"],),
            ).fetchone()
            if selected_method is None or not selected_method["is_enabled"]:
                return jsonify({"error": "Payment method is disabled."}), 409

            connection.execute(
                """
                UPDATE payments
                SET payment_status = 'CONFIRMED',
                    reference_code = ?,
                    created_at = ?
                WHERE id = ?;
                """,
                (
                    reference_code or f"CONFIRMED_{order['order_number']}",
                    now,
                    selected_payment["id"],
                ),
            )
            paid_amount = round(float(selected_payment["amount"]), 2)
        else:
            if payment_method_id is None:
                return jsonify({"error": "payment_method_id or payment_id is required."}), 400

            selected_method = connection.execute(
                """
                SELECT id, name, method_type, is_enabled
                FROM payment_methods
                WHERE id = ?;
                """,
                (payment_method_id,),
            ).fetchone()
            if selected_method is None:
                return jsonify({"error": "Payment method not found."}), 404
            if not selected_method["is_enabled"]:
                return jsonify({"error": "Payment method is disabled."}), 409

            paid_amount = round(float(order["total_amount"]), 2)
            payment_id = connection.execute(
                """
                INSERT INTO payments (
                    order_id,
                    payment_method_id,
                    amount,
                    payment_status,
                    reference_code,
                    created_at
                )
                VALUES (?, ?, ?, 'CONFIRMED', ?, ?);
                """,
                (
                    order_id,
                    selected_method["id"],
                    paid_amount,
                    reference_code or f"CONFIRMED_{order['order_number']}",
                    now,
                ),
            ).lastrowid

        connection.execute(
            "UPDATE orders SET order_status = 'PAID' WHERE id = ?;",
            (order_id,),
        )
        connection.execute(
            """
            INSERT INTO order_status_history (
                order_id,
                previous_status,
                next_status,
                changed_by,
                changed_at
            )
            VALUES (?, ?, 'PAID', ?, ?);
            """,
            (order_id, order["order_status"], changed_by, now),
        )

    event_payload = {
        "order_id": order_id,
        "order_number": order["order_number"],
        "payment_status": "PAID",
        "amount": paid_amount,
        "paid_at": now,
    }
    _emit_customer_event("customer:payment_confirmed", event_payload)

    return jsonify(
        {
            "order_id": order_id,
            "order_number": order["order_number"],
            "order_status": "PAID",
            "payment": {
                "payment_id": payment_id,
                "payment_method_id": selected_method["id"],
                "payment_method": selected_method["name"],
                "payment_type": selected_method["method_type"],
                "amount": paid_amount,
                "reference_code": reference_code or f"CONFIRMED_{order['order_number']}",
            },
        }
    )
