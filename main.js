// ============================================================
// MR BROWN'S — Main Application JS
// Cart system, Music Player, Scroll reveals, Mobile menu
// ============================================================

// =====================
// THEME SYSTEM
// =====================
// Apply saved theme immediately to prevent flash
(function () {
    const saved = localStorage.getItem('mb-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
})();

function initThemePicker() {
    const saved = localStorage.getItem('mb-theme');
    // If already chosen, skip the picker
    if (saved) return;

    const overlay = document.createElement('div');
    overlay.className = 'theme-picker-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Choose your theme');
    overlay.innerHTML = `
        <div class="theme-picker-box">
            <span class="theme-picker-eyebrow">Welcome to Mr Brown's 🇯🇲</span>
            <div class="theme-picker-title">Choose Your Vibe</div>
            <p class="theme-picker-sub">Pick a look — you can always change it later.</p>
            <div class="theme-picker-cards">
                <button class="theme-card theme-card-dark" id="pickDark" aria-label="Choose Dark Theme">
                    <div class="theme-card-preview">
                        <span class="preview-dot" style="background:#00a63b"></span>
                        <span class="preview-dot" style="background:#ffd000"></span>
                        <span class="preview-dot" style="background:#e8112d"></span>
                    </div>
                    <div class="theme-card-name">Theme 1 — Dark</div>
                    <div class="theme-card-desc">Bold &amp; moody. Rich colours on a deep dark canvas.</div>
                </button>
                <button class="theme-card theme-card-light" id="pickLight" aria-label="Choose Light Theme">
                    <div class="theme-card-preview">
                        <span class="preview-dot" style="background:#007a2c"></span>
                        <span class="preview-dot" style="background:#f0a800"></span>
                        <span class="preview-dot" style="background:#cc0e25"></span>
                    </div>
                    <div class="theme-card-name">Theme 2 — Light</div>
                    <div class="theme-card-desc">Warm &amp; vibrant. Bright &amp; full of Jamaican sunshine.</div>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    function pickTheme(theme) {
        localStorage.setItem('mb-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.4s ease';
        setTimeout(() => overlay.remove(), 400);
    }

    document.getElementById('pickDark').addEventListener('click', () => pickTheme('dark'));
    document.getElementById('pickLight').addEventListener('click', () => pickTheme('light'));
}

// =====================
// PRODUCT CATALOGUE
// =====================
const PRODUCTS = {
    'scotch-bonnet': {
        id: 'scotch-bonnet',
        name: 'Scotch Bonnet & Papaya',
        emoji: '🌶️',
        price: 5.99,
        description: 'Fiery scotch bonnet & sweet papaya — pure fire for your plate.'
    },
    'jerk-marinade': {
        id: 'jerk-marinade',
        name: 'Authentic Jerk Marinade',
        emoji: '🫙',
        price: 6.99,
        description: 'Yard-style jerk marinade packed with pimento & scotch bonnet.'
    },
    'seasoning': {
        id: 'seasoning',
        name: 'All-Purpose Seasoning',
        emoji: '🧂',
        price: 4.99,
        description: 'The secret dry rub behind every Mr Brown\'s dish.'
    },
    'bundle': {
        id: 'bundle',
        name: 'The Ultimate Bundle',
        emoji: '⭐',
        price: 15.99,
        description: 'All 3 products — the complete Mr Brown\'s experience.'
    }
};

// =====================
// CART STATE
// =====================
let cart = JSON.parse(localStorage.getItem('mb-cart') || '[]');

function saveCart() {
    localStorage.setItem('mb-cart', JSON.stringify(cart));
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + (PRODUCTS[item.id]?.price || 0) * item.qty, 0);
}

function getCartCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
}

function addToCart(productId) {
    const existing = cart.find(i => i.id === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ id: productId, qty: 1 });
    }
    saveCart();
    renderCartSidebar();
    updateCartBadge(true);
    openCart();
}

function updateQty(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    item.qty = Math.max(0, item.qty + delta);
    if (item.qty === 0) cart = cart.filter(i => i.id !== productId);
    saveCart();
    renderCartSidebar();
    updateCartBadge(false);
}

function removeFromCart(productId) {
    cart = cart.filter(i => i.id !== productId);
    saveCart();
    renderCartSidebar();
    updateCartBadge(false);
}

// =====================
// CART UI
// =====================
function updateCartBadge(bump = false) {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const count = getCartCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
    if (bump) {
        badge.classList.add('bump');
        setTimeout(() => badge.classList.remove('bump'), 350);
    }
}

function openCart() {
    document.getElementById('cartDrawer')?.classList.add('open');
    document.getElementById('cartOverlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    document.getElementById('cartDrawer')?.classList.remove('open');
    document.getElementById('cartOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
}

function renderCartSidebar() {
    const container = document.getElementById('cartItemsContainer');
    const emptyState = document.getElementById('cartEmpty');
    const footEl = document.getElementById('cartFoot');
    const totalEl = document.getElementById('cartTotal');
    if (!container) return;

    container.innerHTML = '';

    if (cart.length === 0) {
        emptyState && (emptyState.style.display = 'flex');
        footEl && (footEl.style.display = 'none');
        return;
    }

    emptyState && (emptyState.style.display = 'none');
    footEl && (footEl.style.display = 'block');

    cart.forEach(item => {
        const prod = PRODUCTS[item.id];
        if (!prod) return;
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
      <div class="cart-item-emoji">${prod.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${prod.name}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">£${prod.price.toFixed(2)} each</div>
        <div class="cart-qty-row">
          <button class="qty-btn" onclick="window.MrBrowns.updateQty('${item.id}', -1)">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" onclick="window.MrBrowns.updateQty('${item.id}', 1)">+</button>
          <button class="cart-remove" onclick="window.MrBrowns.removeFromCart('${item.id}')">Remove</button>
        </div>
      </div>
      <div class="cart-item-price">£${(prod.price * item.qty).toFixed(2)}</div>
    `;
        container.appendChild(el);
    });

    if (totalEl) totalEl.textContent = `£${getCartTotal().toFixed(2)}`;
}

// =====================
// MUSIC PLAYER
// =====================
// Royalty-free reggae/ska track from Freesound/ccMixter
// Using a direct MP3 stream from the Free Music Archive (CC licensed)
const TRACKS = [
    {
        url: '/MrBrownsBGMusic.mp3',
        song: 'Island Vibes',
        artist: 'Jamaican Mood'
    }
];

let audioEl = null;
let isPlaying = false;

function initMusicPlayer() {
    const playBtn = document.getElementById('musicPlayBtn');
    const eq = document.getElementById('musicEq');
    if (!playBtn) return;

    // Create audio element
    audioEl = new Audio();
    audioEl.src = TRACKS[0].url;
    audioEl.loop = true;
    audioEl.volume = 0.35;

    playBtn.addEventListener('click', () => {
        if (isPlaying) {
            audioEl.pause();
            isPlaying = false;
            playBtn.textContent = '▶';
            playBtn.classList.remove('playing');
            eq && eq.classList.add('paused');
        } else {
            audioEl.play().catch(() => {
                // Autoplay blocked - show tooltip
                console.log('Autoplay requires user interaction first.');
            });
            isPlaying = true;
            playBtn.textContent = '⏸';
            playBtn.classList.add('playing');
            eq && eq.classList.remove('paused');
        }
    });
}

// =====================
// INJECT GLOBAL HTML (Cart Drawer + Music Player + FAB)
// =====================
function injectGlobalUI() {
    // Cart Sidebar HTML
    const cartHTML = `
    <div class="cart-overlay" id="cartOverlay"></div>
    <div class="cart-drawer" id="cartDrawer" role="dialog" aria-label="Shopping Cart">
      <div class="cart-head">
        <h2>Your <span style="color:var(--yellow)">Cart</span> 🛒</h2>
        <button class="cart-close" id="cartCloseBtn" aria-label="Close Cart">✕</button>
      </div>
      <div class="cart-items" id="cartItemsContainer">
        <div class="cart-empty" id="cartEmpty">
          <div class="cart-empty-icon">🫙</div>
          <p>Your cart is empty!<br>Add some of Mr Brown's finest to get started.</p>
        </div>
      </div>
      <div class="cart-foot" id="cartFoot" style="display:none;">
        <div class="cart-subtotal">
          <span>Total</span>
          <strong id="cartTotal">£0.00</strong>
        </div>
        <p class="cart-note">Shipping calculated at checkout. 🇯🇲</p>
        <a href="/checkout.html" class="btn btn-green btn-checkout">Checkout →</a>
      </div>
    </div>

    <!-- Floating Cart Button -->
    <button class="cart-fab" id="cartFab" aria-label="Open cart">
      🛒
      <span class="cart-fab-badge" id="cartBadge" style="display:none;">0</span>
    </button>

    <!-- Music Player -->
    <div class="music-player" id="musicPlayer" role="region" aria-label="Music Player">
      <button class="music-play-btn" id="musicPlayBtn" aria-label="Play/Pause music">▶</button>
      <div class="music-info">
        <div class="music-song" id="musicSong">ISLAND VIBES</div>
        <div class="music-artist">🇯🇲 Mr Brown's Kitchen Radio</div>
      </div>
      <div class="music-eq paused" id="musicEq" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
    </div>
  `;
    document.body.insertAdjacentHTML('beforeend', cartHTML);

    // Wire up cart open/close
    document.getElementById('cartFab')?.addEventListener('click', openCart);
    document.getElementById('cartCloseBtn')?.addEventListener('click', closeCart);
    document.getElementById('cartOverlay')?.addEventListener('click', closeCart);

    // Init
    updateCartBadge(false);
    renderCartSidebar();
    initMusicPlayer();
}

// =====================
// WIRE "ADD TO CART" BUTTONS
// =====================
function wireAddToCartButtons() {
    document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
        btn.addEventListener('click', () => {
            const productId = btn.getAttribute('data-add-to-cart');
            if (productId) addToCart(productId);
        });
    });
}

// =====================
// MOBILE NAV
// =====================
function initMobileNav() {
    const toggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    if (!toggle || !navLinks) return;

    toggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    navLinks.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            navLinks.classList.remove('open');
            document.body.style.overflow = '';
        });
    });
}

// =====================
// SCROLL REVEAL
// =====================
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(el => observer.observe(el));
}

// =====================
// NAVBAR SHRINK
// =====================
function initNavbarShrink() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    window.addEventListener('scroll', () => {
        navbar.style.padding = window.scrollY > 60 ? '12px 5%' : '18px 5%';
    }, { passive: true });
}

// =====================
// CHECKOUT PAGE LOGIC
// =====================
function initCheckout() {
    const orderLines = document.getElementById('orderLines');
    const orderTotal = document.getElementById('checkoutTotal');
    const checkoutForm = document.getElementById('checkoutForm');
    const checkoutView = document.getElementById('checkoutView');
    const successView = document.getElementById('checkoutSuccess');

    if (!orderLines) return; // Not on checkout page

    // Render order summary from cart
    if (cart.length === 0) {
        orderLines.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">Your cart is empty. <a href="/shop.html" style="color:var(--yellow)">Go back to shop →</a></p>';
        if (orderTotal) orderTotal.textContent = '£0.00';
    } else {
        orderLines.innerHTML = cart.map(item => {
            const prod = PRODUCTS[item.id];
            if (!prod) return '';
            return `
        <div class="order-line">
          <span class="order-line-name">${prod.emoji} ${prod.name}</span>
          <span class="order-line-qty">×${item.qty}</span>
          <span class="order-line-price">£${(prod.price * item.qty).toFixed(2)}</span>
        </div>
      `;
        }).join('<div class="order-divider"></div>');
        if (orderTotal) orderTotal.textContent = `£${getCartTotal().toFixed(2)}`;
    }

    // Handle form submit
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Clear cart on successful order
            cart = [];
            saveCart();
            // Show success
            if (checkoutView) checkoutView.style.display = 'none';
            if (successView) {
                successView.style.display = 'block';
                successView.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            updateCartBadge(false);
        });
    }
}

// =====================
// EXPOSE GLOBAL API
// =====================
window.MrBrowns = { addToCart, updateQty, removeFromCart, openCart, closeCart };

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
    initThemePicker();
    injectGlobalUI();
    wireAddToCartButtons();
    initMobileNav();
    initScrollReveal();
    initNavbarShrink();
    initCheckout();
});
