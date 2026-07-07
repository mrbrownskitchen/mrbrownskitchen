const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Serve the frontend from the parent directory
const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR));
// Vite serves public/ at root — replicate that for Express
app.use(express.static(path.join(__dirname, '..', 'public')));

// Middleware
app.use(cors());
app.use(express.json());

// =====================
// DATABASE SETUP
// =====================
const db = new Database('./orders.db');
console.log('✓ Connected to SQLite database');

db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        items TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        square_payment_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reserves (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        product_id TEXT,
        consent_given INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Add consent_given column if upgrading from old schema
try { db.exec(`ALTER TABLE reserves ADD COLUMN consent_given INTEGER DEFAULT 0`); } catch {}

// Seed products if empty
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (productCount.count === 0) {
    db.prepare(`INSERT INTO products (id, name, price, stock) VALUES
        ('scotch-bonnet', 'Scotch Bonnet & Papaya Sauce', 5.99, 50),
        ('jerk-marinade', 'Authentic Jerk Marinade', 6.99, 50),
        ('seasoning', 'All-Purpose Seasoning', 4.99, 50)
    `).run();
    console.log('✓ Products seeded');
}
console.log('✓ Database tables ready');

// =====================
// SQUARE API HELPER
// =====================
const SQUARE_HOST = process.env.NODE_ENV === 'production'
    ? 'connect.squareup.com'
    : 'connect.squareupsandbox.com';

function callSquareAPI(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: SQUARE_HOST,
            port: 443,
            path: endpoint,
            method: method,
            headers: {
                'Square-Version': '2024-01-18',
                'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// =====================
// ROUTES
// =====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Get products
app.get('/api/products', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM products').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create payment with Square
app.post('/api/payment', async (req, res) => {
    const { cart, customer, sourceId } = req.body;

    if (!cart || !cart.length || !customer || !customer.email || !sourceId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const productIds = cart.map(item => item.productId || item.id).filter(Boolean);
        const placeholders = productIds.map(() => '?').join(',');
        const dbProducts = db.prepare(`SELECT id, price FROM products WHERE id IN (${placeholders})`).all(...productIds);

        const priceMap = {};
        dbProducts.forEach(p => { priceMap[p.id] = p.price; });

        let total = 0;
        for (const item of cart) {
            const pid = item.productId || item.id;
            const price = priceMap[pid];
            if (!price) return res.status(400).json({ error: `Unknown product: ${pid}` });
            total += price * (item.qty || 1) * 100;
        }
        total = Math.round(total);

        if (total <= 0) {
            return res.status(400).json({ error: 'Order total must be greater than £0' });
        }

        const paymentResult = await callSquareAPI('POST', '/v2/payments', {
            source_id: sourceId,
            amount_money: { amount: total, currency: 'GBP' },
            autocomplete: true,
            idempotency_key: uuidv4(),
            note: `Order from ${customer.email}`,
        });

        if (paymentResult.status !== 200 || !paymentResult.data.payment) {
            console.error('Square API error:', paymentResult.data);
            return res.status(400).json({ error: paymentResult.data.errors?.[0]?.detail || 'Payment failed' });
        }

        const orderId = uuidv4();
        const enrichedCart = cart.map(item => ({ ...item, price: priceMap[item.productId || item.id] }));

        db.prepare(`
            INSERT INTO orders (id, customer_name, customer_email, customer_phone, items, total, status, square_payment_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            orderId,
            customer.firstName + ' ' + customer.lastName,
            customer.email,
            customer.phone || '',
            JSON.stringify(enrichedCart),
            total / 100,
            'completed',
            paymentResult.data.payment.id
        );

        const decrementStock = db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?');
        for (const item of cart) {
            decrementStock.run(item.qty || 1, item.productId || item.id);
        }

        res.json({ success: true, orderId, paymentId: paymentResult.data.payment.id });
    } catch (error) {
        console.error('Payment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save reserve/waitlist signup
app.post('/api/reserves', (req, res) => {
    const { name, email, productId, consentGiven } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
    if (!consentGiven) return res.status(400).json({ error: 'Consent is required to join the waitlist' });
    try {
        const id = uuidv4();
        db.prepare('INSERT INTO reserves (id, name, email, product_id, consent_given) VALUES (?, ?, ?, ?, ?)')
            .run(id, name, email, productId || null, 1);
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all orders (admin)
app.get('/api/orders', authenticateAdmin, (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all reserves (admin)
app.get('/api/reserves', authenticateAdmin, (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM reserves ORDER BY created_at DESC').all());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update product stock (admin)
app.post('/api/products/:id/stock', authenticateAdmin, (req, res) => {
    const { stock } = req.body;
    const { id } = req.params;
    if (stock === undefined) return res.status(400).json({ error: 'Stock value required' });
    try {
        db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(stock, id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin login (simple password check)
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;

    if (password === process.env.ADMIN_PASSWORD) {
        // In production, use proper JWT tokens
        res.json({ success: true, token: Buffer.from(password).toString('base64') });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// Serve admin login page
app.get('/admin/login.html', (req, res) => {
    res.sendFile(__dirname + '/admin-login.html');
});

// Serve admin dashboard (protected)
app.get('/admin', (req, res) => {
    res.send(getAdminHTML());
});

// =====================
// MIDDLEWARE
// =====================
function authenticateAdmin(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    const expectedToken = Buffer.from(process.env.ADMIN_PASSWORD).toString('base64');

    if (token === expectedToken) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

// =====================
// ADMIN DASHBOARD HTML
// =====================
function getAdminHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Mr Brown's — Admin Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        header { background: #2c1a0a; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
        h1 { font-size: 24px; }
        .logout-btn { background: #e8112d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        .logout-btn:hover { background: #b50d23; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
        .panel { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .panel h2 { font-size: 18px; margin-bottom: 15px; color: #2c1a0a; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background: #f9f9f9; font-weight: 600; }
        .stock-input { width: 70px; padding: 5px; border: 1px solid #ddd; border-radius: 4px; }
        .update-btn { background: #007a2c; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px; }
        .update-btn:hover { background: #005a20; }
        .status-completed { color: #007a2c; font-weight: 600; }
        .status-pending { color: #f0a800; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Mr Brown's Admin Dashboard</h1>
            <button class="logout-btn" onclick="logout()">Logout</button>
        </header>

        <div class="grid">
            <!-- Orders Panel -->
            <div class="panel">
                <h2>Recent Orders</h2>
                <table id="ordersTable">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody id="ordersList">
                        <tr><td colspan="5" style="text-align:center; color: #999;">Loading...</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- Inventory Panel -->
            <div class="panel">
                <h2>Inventory</h2>
                <table id="inventoryTable">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Price</th>
                            <th>Stock</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="inventoryList">
                        <tr><td colspan="4" style="text-align:center; color: #999;">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Waitlist Panel -->
        <div class="panel">
            <h2>Waitlist Signups</h2>
            <table id="reservesTable">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Product</th>
                        <th>Consent</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody id="reservesList">
                    <tr><td colspan="5" style="text-align:center; color: #999;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        const API_BASE = '';
        const token = localStorage.getItem('adminToken');

        if (!token) {
            window.location.href = '/admin/login.html';
            throw new Error('Not authenticated');
        }

        async function authFetch(url, options = {}) {
            const res = await fetch(url, {
                ...options,
                headers: { ...(options.headers || {}), Authorization: \`Bearer \${token}\` }
            });
            if (res.status === 401) {
                localStorage.removeItem('adminToken');
                window.location.href = '/admin/login.html';
                throw new Error('Session expired');
            }
            return res;
        }

        async function loadData() {
            try {
                const [ordersRes, productsRes, reservesRes] = await Promise.all([
                    authFetch(\`\${API_BASE}/api/orders\`),
                    fetch(\`\${API_BASE}/api/products\`),
                    authFetch(\`\${API_BASE}/api/reserves\`),
                ]);
                const [orders, products, reserves] = await Promise.all([
                    ordersRes.json(),
                    productsRes.json(),
                    reservesRes.json(),
                ]);

                // Render orders
                document.getElementById('ordersList').innerHTML = orders.map(order => \`
                    <tr>
                        <td style="font-size: 12px;">\${order.id.substring(0, 8)}...</td>
                        <td>\${order.customer_name}</td>
                        <td>£\${order.total.toFixed(2)}</td>
                        <td><span class="status-\${order.status}">\${order.status}</span></td>
                        <td style="font-size: 12px;">\${new Date(order.created_at).toLocaleDateString()}</td>
                    </tr>
                \`).join('') || '<tr><td colspan="5" style="text-align:center; color: #999;">No orders yet</td></tr>';

                // Render inventory
                document.getElementById('inventoryList').innerHTML = products.map(prod => \`
                    <tr>
                        <td>\${prod.name}</td>
                        <td>£\${prod.price.toFixed(2)}</td>
                        <td>
                            <input type="number" class="stock-input" value="\${prod.stock}" id="stock-\${prod.id}">
                        </td>
                        <td>
                            <button class="update-btn" onclick="updateStock('\${prod.id}')">Update</button>
                        </td>
                    </tr>
                \`).join('');

                // Render reserves
                document.getElementById('reservesList').innerHTML = reserves.map(r => \`
                    <tr>
                        <td>\${r.name}</td>
                        <td>\${r.email}</td>
                        <td>\${r.product_id || 'All'}</td>
                        <td style="color:\${r.consent_given ? '#007a2c' : '#e8112d'};">\${r.consent_given ? '✓ Yes' : '✗ No'}</td>
                        <td style="font-size: 12px;">\${new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                \`).join('') || '<tr><td colspan="5" style="text-align:center; color: #999;">No signups yet</td></tr>';
            } catch (error) {
                console.error('Error loading data:', error);
                if (error.message !== 'Session expired') {
                    document.getElementById('ordersList').innerHTML = '<tr><td colspan="5" style="color:#e8112d;">Failed to load — check backend is running</td></tr>';
                }
            }
        }

        async function updateStock(productId) {
            const input = document.getElementById(\`stock-\${productId}\`);
            const stock = parseInt(input.value);
            const btn = input.closest('tr').querySelector('.update-btn');
            const original = btn.textContent;
            if (isNaN(stock) || stock < 0) { alert('Enter a valid stock number'); return; }
            btn.disabled = true;
            btn.textContent = 'Saving...';
            try {
                const response = await authFetch(\`\${API_BASE}/api/products/\${productId}/stock\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stock }),
                });
                if (response.ok) {
                    btn.textContent = '✓ Saved';
                    btn.style.background = '#007a2c';
                    setTimeout(() => { btn.textContent = original; btn.disabled = false; btn.style.background = ''; }, 2000);
                } else {
                    const err = await response.json();
                    alert('Error: ' + (err.error || 'Could not update stock'));
                    btn.textContent = original;
                    btn.disabled = false;
                }
            } catch (error) {
                console.error('Error:', error);
                btn.textContent = original;
                btn.disabled = false;
            }
        }

        function logout() {
            localStorage.removeItem('adminToken');
            window.location.href = '/admin/login.html';
        }

        loadData();
        setInterval(loadData, 5000); // Refresh every 5 seconds
    </script>
</body>
</html>
    `;
}

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
    console.log(`\n🚀 Mr Brown's Backend running at http://localhost:${PORT}`);
    console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin\n`);
});

process.on('SIGINT', () => process.exit());
