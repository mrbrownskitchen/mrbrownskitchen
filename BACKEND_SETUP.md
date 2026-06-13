# Backend Setup Guide — Complete

## What's Been Created

✅ **Node.js/Express Backend** (`backend/server.js`)
- Handles Square payments
- Stores orders in SQLite database
- Tracks inventory
- Captures waitlist/reserve signups

✅ **Admin Dashboard** (`http://localhost:3001/admin`)
- View all orders
- Update product stock
- See waitlist signups
- Simple password authentication

✅ **Frontend Integration** (`checkout.html`)
- Square Web Payments card form
- Sends payment to backend
- Shows order confirmation

---

## Setup Steps

### Step 1: Get Square Credentials

1. Go to https://developer.squareup.com/
2. Sign in with your Square account
3. Click on your application (or create one)
4. Go to **Credentials** tab → **Production**
5. Copy these three values:
   - **Application ID** (starts with `sq0a...`)
   - **Access Token** (starts with `sq0atp_...`)  
   - **Location ID** (go to Locations, it's the ID)

### Step 2: Add Credentials to Backend

Edit `backend/.env` and add your values:

```env
SQUARE_APPLICATION_ID=sq0aXXXXXXXXXXXXXXXXXXXXXX
SQUARE_ACCESS_TOKEN=sq0atp_XXXXXXXXXXXXXXXXXXXXXXX
SQUARE_LOCATION_ID=L123XXX...

ADMIN_PASSWORD=change_this_to_something_secure

PORT=3001
NODE_ENV=development
```

### Step 3: Add Square App ID to Frontend

Edit `checkout.html` and find this line (around line 185):

```javascript
const SQUARE_APP_ID = 'sq0atp_YOUR_APP_ID_HERE';
```

Replace with your Application ID:

```javascript
const SQUARE_APP_ID = 'sq0aXXXXXXXXXXXXXXXXXXXXXX';
```

### Step 4: Start the Backend

```bash
cd backend
npm start
```

You should see:
```
🚀 Mr Brown's Backend running at http://localhost:3001
📊 Admin dashboard: http://localhost:3001/admin
```

### Step 5: Start the Frontend (in another terminal)

```bash
npm run dev
```

### Step 6: Test It Out

1. **Frontend dev server:** http://localhost:5173
   - Add items to cart
   - Go to checkout
   - You should see the Square card form

2. **Admin dashboard:** http://localhost:3001/admin
   - Password: `admin123` (or what you set in `.env`)
   - View orders, update inventory, see signups

---

## Testing Payments

Square provides test card numbers. Use these to test without real charges:

| Card | Number | Exp | CVV |
|------|--------|-----|-----|
| Visa (Success) | `4532015112830366` | 12/25 | 123 |
| Visa (Decline) | `4532009996680293` | 12/25 | 123 |
| Amex (Success) | `378282246310005` | 12/25 | 123 |

**Important:** These only work in test mode. For production, you'll need to switch your Square credentials to production.

---

## What Still Needs Updating

### 1. Reserve Form → Capture Emails

Update `reserve.html` to send signups to the backend instead of the fake form.

Change the form submit handler from:
```javascript
e.preventDefault();
document.getElementById('formView').style.display = 'none';
```

To:
```javascript
e.preventDefault();
const name = document.getElementById('name').value;
const email = document.getElementById('email').value;
const product = document.getElementById('product').value;

fetch('http://localhost:3001/api/reserves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, productId: product })
}).then(() => {
    document.getElementById('formView').style.display = 'none';
    document.getElementById('successView').style.display = 'block';
});
```

### 2. Cart Pricing

Make sure the cart system in `main.js` stores the price with each item:
```javascript
cart.push({ id: productId, qty: 1, price: 5.99 }); // Include price
```

---

## File Structure

```
MrBrowns/
├── backend/
│   ├── server.js           (Express app)
│   ├── admin-login.html    (Admin login page)
│   ├── .env                (Your credentials)
│   ├── .env.example        (Template)
│   ├── package.json
│   ├── README.md
│   └── orders.db           (SQLite — auto-created)
├── index.html
├── shop.html
├── reserve.html            (needs update for real emails)
├── checkout.html           (updated with Square)
├── main.js
├── style.css
└── ... other files
```

---

## Common Issues

**Backend won't start:**
- Check that port 3001 is free
- Make sure `.env` file exists in `backend/` folder
- Run `npm install` in `backend/` folder

**Square form doesn't appear:**
- Check browser console for errors
- Make sure Square app ID is correct in `checkout.html`
- Make sure backend is running (http://localhost:3001/health should return `{"status":"ok"}`)

**Admin dashboard login fails:**
- Default password is `admin123`
- Make sure backend is running
- Check the password in `backend/.env`

**Payments failing:**
- Check you're using test card numbers (listed above)
- Make sure Square credentials are correct
- Check browser console for error messages

---

## Next Steps After Testing

1. **Wire up reserve form** to actually save emails
2. **Deploy backend** to production (Heroku, Railway, Render, etc.)
3. **Update checkout to use production URLs** (not localhost:3001)
4. **Switch Square to production** mode (not test)
5. **Set a secure admin password** (not `admin123`)
6. **Add SSL certificate** to deployed backend

---

## Need Help?

- **Square docs:** https://developer.squareup.com/docs
- **Check logs:** Run backend with `npm start` and watch the terminal
- **Test the API:** Use Postman or curl to test routes

```bash
# Test backend is running
curl http://localhost:3001/api/health

# Get products
curl http://localhost:3001/api/products
```
