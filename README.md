# Odoo POS Cafe

Restaurant POS hackathon project with table-based ordering, kitchen dispatch, and multi-payment support.

## Current Implementation Baseline

### Backend
- Flask API with CORS and Socket.IO bootstrapped.
- SQLite schema created for users, sessions, floors/tables, products, orders, payments, and kitchen tickets.
- Demo data seeding on startup.
- Implemented endpoints:
	- POST /api/auth/signup
	- POST /api/auth/login
	- GET /api/auth/me
	- GET /api/products
	- GET /api/floors
	- GET /api/payment-methods
	- PATCH /api/payment-methods/{method_id}
	- POST /api/floors
	- POST /api/tables
	- PATCH /api/tables/{table_id}
	- POST /api/products
	- POST /api/sessions/open
	- POST /api/sessions/{session_id}/close
	- POST /api/orders
	- POST /api/orders/{order_id}/send-kitchen
	- GET /api/sessions/active
	- GET /api/kitchen/tickets
	- PATCH /api/kitchen/tickets/{ticket_id}/status
	- POST /api/orders/{order_id}/payments/upi-qr
	- POST /api/orders/{order_id}/payments/confirm

### Frontend
- Replaced Vite starter with a POS shell using the Botanical Ledger design language.
- Added login/signup screen and token persistence.
- Added floor/table selection, product selection, order tray, and send-to-kitchen flow.
- Added session recovery so page refresh/login restores active register session.
- Added payment flow for cash/digital and UPI QR confirmation.
- Added kitchen board with ticket stage transitions (To Cook -> Preparing -> Completed).
- Added manager Back-end configuration view:
	- Toggle payment methods and update UPI ID
	- Create floors and tables
	- Activate/deactivate tables
	- Create products
- Added API client module and Vite proxy for backend integration.

## Local Setup

### 1) Backend setup
1. Move into server directory.
2. Create virtual environment and install dependencies.
3. Copy .env.example to .env and adjust values if needed.
4. Run Flask app.

Commands:

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py

Backend runs on http://localhost:5000.

### 2) Frontend setup
1. Move into client directory.
2. Install dependencies.
3. Start dev server.

Commands:

npm install
npm run dev

Dedicated startup scripts:

npm run dev:manager
npm run dev:kitchen

`npm run dev:manager` runs with app mode `manager` on port 5174.
`npm run dev:kitchen` runs with app mode `kitchen` on port 5175 and does not show login/signup.

Run on a custom port (example for manager app):

npm run dev --port 5174

Alternative npm-compatible syntax:

npm run dev -- --port 5174

Run a dedicated kitchen display on another port:

npm run dev --port 5175

Open the kitchen route at:

http://localhost:5175/kitchen

No-login kitchen display setup:

1. Set server key in server/.env (must match client):
KITCHEN_DISPLAY_KEY=kitchen-display-dev-key
2. Set client key in client/.env:
VITE_KITCHEN_DISPLAY_KEY=kitchen-display-dev-key
3. Restart backend and frontend dev servers after updating env files.

Optional explicit mode override in client/.env:
VITE_APP_MODE=manager|kitchen

Frontend runs on http://localhost:5173 and proxies API calls to the backend.

## Next Milestones
1. Payment completion flow (cash/digital/UPI QR confirm).
2. Kitchen board stage transitions (To Cook -> Preparing -> Completed).
3. Customer display screen and live updates.
4. Reporting endpoints and dashboard filters.
