# Mr Brown's Backend — Node.js + Express + Square

This backend handles:
- Square payment processing
- Order management
- Inventory tracking
- Waitlist signups
- Admin dashboard

## Quick Setup

### 1. Get Square Credentials

1. Go to [Square Developer Dashboard](https://developer.squareup.com/)
2. Sign in with your Square account
3. Select your application (or create one)
4. Go to **Credentials** tab
5. Copy:
   - **Application ID** (starts with `sq0a...`)
   - **Access Token** (starts with `sq0atp_...`)
   - **Location ID** (from Dashboard → Locations)

### 2. Add Credentials to `.env`

Edit `.env` and paste your credentials:

```
SQUARE_APPLICATION_ID=sq0a...
SQUARE_ACCESS_TOKEN=sq0atp_...
SQUARE_LOCATION_ID=L123...
ADMIN_PASSWORD=change_me_to_something_secure
```

### 3. Start the Server

```bash
npm start
```

You should see:
```
🚀 Mr Brown's Backend running at http://localhost:3001
📊 Admin dashboard: http://localhost:3001/admin
```

### 4. Access Admin Dashboard

1. Open http://localhost:3001/admin
2. You'll be redirected to login page
3. Enter the password from your `.env` file (default: `admin123`)
4. You can now:
   - View all orders
   - Update inventory stock
   - See waitlist signups

## API Routes

### Public Routes

- `GET /api/products` — Get all products with stock
- `POST /api/payment` — Create Square payment (requires source token)
- `POST /api/reserves` — Add email to waitlist

### Admin Routes (require password auth)

- `GET /api/orders` — Get all orders
- `GET /api/reserves` — Get all waitlist signups
- `POST /api/products/:id/stock` — Update product stock

## Database

Uses SQLite (`orders.db`). Three tables:
- **products** — Scotch Bonnet, Jerk Marinade, All-Purpose Seasoning
- **orders** — Customer orders with Square payment info
- **reserves** — Waitlist signups

## Next Steps

1. Update `checkout.html` on the frontend to use Square Web Payments SDK
2. Wire up the reserve form to send data to this backend
3. Deploy when ready (Heroku, Railway, etc.)

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SQUARE_APPLICATION_ID` | Square app identifier |
| `SQUARE_ACCESS_TOKEN` | Square API authentication |
| `SQUARE_LOCATION_ID` | Which Square location to charge |
| `PORT` | Server port (default 3001) |
| `ADMIN_PASSWORD` | Password to access `/admin` |
