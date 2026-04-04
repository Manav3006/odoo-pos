PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'staff',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS terminals (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	is_active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	terminal_id INTEGER NOT NULL,
	opened_by INTEGER NOT NULL,
	opened_at TEXT NOT NULL,
	closed_at TEXT,
	opening_balance REAL NOT NULL DEFAULT 0,
	closing_balance REAL,
	closing_sales REAL,
	status TEXT NOT NULL DEFAULT 'OPEN',
	FOREIGN KEY (terminal_id) REFERENCES terminals(id),
	FOREIGN KEY (opened_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS categories (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	category_id INTEGER,
	price REAL NOT NULL,
	unit TEXT NOT NULL,
	tax_rate REAL NOT NULL DEFAULT 0,
	description TEXT,
	is_active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS product_variants (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	product_id INTEGER NOT NULL,
	attribute_name TEXT NOT NULL,
	attribute_value TEXT NOT NULL,
	price_adjustment REAL NOT NULL DEFAULT 0,
	FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_methods (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	method_type TEXT NOT NULL,
	is_enabled INTEGER NOT NULL DEFAULT 1,
	upi_id TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS floors (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tables (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	floor_id INTEGER NOT NULL,
	table_number TEXT NOT NULL,
	seats INTEGER NOT NULL DEFAULT 2,
	is_active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE,
	UNIQUE (floor_id, table_number)
);

CREATE TABLE IF NOT EXISTS orders (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	order_number TEXT NOT NULL UNIQUE,
	session_id INTEGER NOT NULL,
	table_id INTEGER NOT NULL,
	customer_id INTEGER,
	created_at TEXT NOT NULL,
	order_status TEXT NOT NULL DEFAULT 'DRAFT',
	subtotal REAL NOT NULL DEFAULT 0,
	tax_total REAL NOT NULL DEFAULT 0,
	total_amount REAL NOT NULL DEFAULT 0,
	FOREIGN KEY (session_id) REFERENCES pos_sessions(id),
	FOREIGN KEY (table_id) REFERENCES tables(id),
	FOREIGN KEY (customer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	order_id INTEGER NOT NULL,
	product_id INTEGER NOT NULL,
	quantity INTEGER NOT NULL,
	unit_price REAL NOT NULL,
	line_subtotal REAL NOT NULL,
	line_tax REAL NOT NULL,
	FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
	FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	order_id INTEGER NOT NULL,
	payment_method_id INTEGER NOT NULL,
	amount REAL NOT NULL,
	payment_status TEXT NOT NULL DEFAULT 'PENDING',
	reference_code TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (order_id) REFERENCES orders(id),
	FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);

CREATE TABLE IF NOT EXISTS kitchen_tickets (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	order_id INTEGER NOT NULL,
	ticket_status TEXT NOT NULL DEFAULT 'TO_COOK',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_status_history (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	order_id INTEGER NOT NULL,
	previous_status TEXT,
	next_status TEXT NOT NULL,
	changed_by INTEGER,
	changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
	FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_order_id ON kitchen_tickets(order_id);
