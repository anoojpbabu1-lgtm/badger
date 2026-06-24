// BAGER Frontend SPA Logic
// State management, routing, cart operations, auth modals, and checkout

let state = {
    currentUser: null,
    products: [],
    cart: JSON.parse(localStorage.getItem('bager_cart')) || [],
};

// --- Toast Notifications ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('active'), 10);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Cart Helpers ---
function saveCart() {
    localStorage.setItem('bager_cart', JSON.stringify(state.cart));
    updateCartBadge();
}

function updateCartBadge() {
    const badge = document.getElementById('cart-item-count');
    if (!badge) return;
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = count;
}

function addToCart(productId, qty = 1) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    if (product.stock === 0) {
        showToast("Sorry, this item is out of stock!", "error");
        return;
    }
    
    const existing = state.cart.find(item => item.product_id === productId);
    const currentQtyInCart = existing ? existing.quantity : 0;
    
    if (currentQtyInCart + qty > product.stock) {
        showToast(`Cannot add more. Only ${product.stock} items left in stock.`, "error");
        return;
    }
    
    if (existing) {
        existing.quantity += qty;
    } else {
        state.cart.push({ product_id: productId, quantity: qty });
    }
    
    saveCart();
    showToast(`Added ${product.name} to cart!`);
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.product_id !== productId);
    saveCart();
    loadCartView();
    showToast("Item removed from cart");
}

function updateCartQuantity(productId, newQty) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    if (newQty <= 0) {
        removeFromCart(productId);
        return;
    }
    
    const cartItem = state.cart.find(item => item.product_id === productId);
    if (!cartItem) return;
    
    if (newQty > product.stock) {
        showToast(`Only ${product.stock} units available in stock.`, "error");
        return;
    }
    
    cartItem.quantity = newQty;
    saveCart();
    loadCartView();
}

// --- View Router & Loader ---
function router() {
    const hash = window.location.hash || '#/';
    
    // Hide all views
    document.querySelectorAll('.spa-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Auth Guards
    const protectedRoutes = ['#/checkout', '#/orders'];
    if (protectedRoutes.includes(hash) && !state.currentUser) {
        window.location.hash = '#/';
        openAuthModal('login');
        showToast("Please log in to continue.", "error");
        return;
    }
    
    if (hash === '#/admin' && (!state.currentUser || state.currentUser.role !== 'admin')) {
        window.location.hash = '#/';
        showToast("Access denied. Admin role required.", "error");
        return;
    }

    // Route matching
    if (hash === '#/' || hash === '') {
        document.getElementById('home-view').classList.add('active');
        loadHomeView();
    } else if (hash.startsWith('#/product/')) {
        const id = parseInt(hash.replace('#/product/', ''));
        document.getElementById('product-view').classList.add('active');
        loadProductView(id);
    } else if (hash === '#/cart') {
        document.getElementById('cart-view').classList.add('active');
        loadCartView();
    } else if (hash === '#/checkout') {
        document.getElementById('checkout-view').classList.add('active');
        loadCheckoutView();
    } else if (hash === '#/orders') {
        document.getElementById('orders-view').classList.add('active');
        loadOrdersView();
    } else if (hash === '#/admin') {
        document.getElementById('admin-view').classList.add('active');
        if (window.loadAdminDashboard) {
            window.loadAdminDashboard();
        }
    } else {
        // Fallback to home
        window.location.hash = '#/';
    }
    
    // Scroll to top on route change
    window.scrollTo(0, 0);
}

// --- Render Home View ---
function loadHomeView(categoryFilter = null, searchQuery = null) {
    const grid = document.getElementById('home-products-grid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Fetching products...</div>';
    
    let url = '/api/products';
    const params = [];
    if (categoryFilter) params.push(`category=${encodeURIComponent(categoryFilter)}`);
    if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
    if (params.length > 0) url += '?' + params.join('&');
    
    fetch(url)
        .then(res => res.json())
        .then(products => {
            state.products = products; // Sync cached products list
            grid.innerHTML = '';
            
            if (products.length === 0) {
                grid.innerHTML = '<div class="loading-spinner">No products found matching the criteria.</div>';
                return;
            }
            
            products.forEach(p => {
                const card = document.createElement('div');
                card.className = 'product-card';
                card.onclick = () => window.location.hash = `#/product/${p.id}`;
                
                const originalPrice = p.price * 1.25; // Mock original price 25% higher
                const discount = 20; // Mock 20% discount
                
                card.innerHTML = `
                    ${p.stock === 0 ? '<span class="card-out-of-stock">Out of Stock</span>' : ''}
                    <div class="product-card-img-wrapper">
                        <img src="${p.image_url}" alt="${p.name}" class="product-card-img" onerror="this.src='/static/images/bager_logo.png'">
                    </div>
                    <div class="product-card-body">
                        <h3 class="product-card-title">${p.name}</h3>
                        <div class="product-card-rating">
                            <span>4.3</span> <i class="fas fa-star"></i>
                        </div>
                        <div class="product-card-pricing">
                            <span class="current-price">₹${p.price.toLocaleString('en-IN')}</span>
                            <span class="original-price">₹${Math.round(originalPrice).toLocaleString('en-IN')}</span>
                            <span class="discount-percentage">${discount}% off</span>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        })
        .catch(err => {
            console.error(err);
            grid.innerHTML = '<div class="loading-spinner">Error loading products. Please try again.</div>';
        });
}

// --- Render Product Details View ---
function loadProductView(productId) {
    const container = document.getElementById('product-details-content');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Fetching product details...</div>';
    
    const p = state.products.find(item => item.id === productId);
    if (!p) {
        // If not in cache, fetch all first
        fetch('/api/products')
            .then(res => res.json())
            .then(products => {
                state.products = products;
                renderDetails(products.find(item => item.id === productId));
            })
            .catch(err => {
                container.innerHTML = '<div class="loading-spinner">Error loading product details.</div>';
            });
    } else {
        renderDetails(p);
    }
    
    function renderDetails(product) {
        if (!product) {
            container.innerHTML = '<div class="loading-spinner">Product not found.</div>';
            return;
        }
        
        let stockBadgeText = 'In Stock';
        let stockClass = 'in-stock';
        if (product.stock === 0) {
            stockBadgeText = 'Out of Stock';
            stockClass = 'out-of-stock';
        } else if (product.stock <= 5) {
            stockBadgeText = `Only ${product.stock} left in stock!`;
            stockClass = 'low-stock';
        }
        
        // Build Specs HTML
        let specsRows = '';
        if (product.specs && Object.keys(product.specs).length > 0) {
            for (const [key, val] of Object.entries(product.specs)) {
                specsRows += `
                    <tr>
                        <td class="specs-label">${key}</td>
                        <td class="specs-val">${val}</td>
                    </tr>
                `;
            }
        } else {
            specsRows = '<tr><td colspan="2" class="text-muted">No specifications listed.</td></tr>';
        }
        
        const originalPrice = product.price * 1.25;
        const discount = 20;
        
        container.innerHTML = `
            <div class="product-image-section">
                <div class="detail-large-img-box">
                    <img src="${product.image_url}" alt="${product.name}" class="detail-large-img" onerror="this.src='/static/images/bager_logo.png'">
                </div>
                <div class="product-detail-actions">
                    <button class="btn btn-secondary btn-large" id="detail-add-cart-btn" ${product.stock === 0 ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart"></i> ADD TO CART
                    </button>
                    <button class="btn btn-primary btn-large" id="detail-buy-now-btn" ${product.stock === 0 ? 'disabled' : ''}>
                        <i class="fas fa-bolt"></i> BUY NOW
                    </button>
                </div>
            </div>
            
            <div class="product-info-section">
                <span class="detail-category">${product.category}</span>
                <h1 class="detail-title">${product.name}</h1>
                
                <div class="detail-rating-row">
                    <div class="detail-rating-badge">
                        <span>4.3</span> <i class="fas fa-star"></i>
                    </div>
                    <span class="detail-reviews-text">1,245 Ratings & 182 Reviews</span>
                </div>
                
                <div class="detail-pricing-row">
                    <span class="detail-current-price">₹${product.price.toLocaleString('en-IN')}</span>
                    <span class="detail-original-price">₹${Math.round(originalPrice).toLocaleString('en-IN')}</span>
                    <span class="detail-discount">${discount}% Off</span>
                </div>
                
                <div class="stock-status-wrapper">
                    <span class="stock-status-badge ${stockClass}">${stockBadgeText}</span>
                </div>
                
                <div class="detail-desc-box">
                    <h3>Product Description</h3>
                    <p class="detail-description">${product.description || 'No description available for this product.'}</p>
                </div>
                
                <div class="specs-box">
                    <h3>Specifications</h3>
                    <table class="specs-table">
                        <tbody>
                            ${specsRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // Add Button Listeners
        document.getElementById('detail-add-cart-btn').onclick = () => {
            addToCart(product.id, 1);
        };
        document.getElementById('detail-buy-now-btn').onclick = () => {
            addToCart(product.id, 1);
            window.location.hash = '#/cart';
        };
    }
}

// --- Render Cart View ---
function loadCartView() {
    const listContainer = document.getElementById('cart-items-list');
    const checkoutActions = document.getElementById('cart-checkout-actions');
    if (!listContainer) return;
    
    if (state.cart.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-cart-state">
                <i class="fas fa-shopping-cart"></i>
                <h3>Your cart is empty!</h3>
                <p>Add items to it now to shop.</p>
                <a href="#/" class="btn btn-primary">Shop Now</a>
            </div>
        `;
        if (checkoutActions) checkoutActions.classList.add('hidden');
        updatePriceSummary(0, 0);
        return;
    }
    
    if (checkoutActions) checkoutActions.classList.remove('hidden');
    listContainer.innerHTML = '';
    
    let subtotal = 0;
    let savings = 0;
    let stockError = false;
    
    state.cart.forEach(item => {
        const p = state.products.find(prod => prod.id === item.product_id);
        if (!p) return;
        
        const itemPrice = p.price * item.quantity;
        const itemOriginal = p.price * 1.25 * item.quantity;
        subtotal += itemPrice;
        savings += (itemOriginal - itemPrice);
        
        const row = document.createElement('div');
        row.className = 'cart-item-row';
        
        // Stock Validation Warning
        let stockWarningHtml = '';
        if (p.stock === 0) {
            stockWarningHtml = '<div class="text-warning" style="font-size:12px; font-weight:600; margin-top:6px;"><i class="fas fa-exclamation-triangle"></i> This item is out of stock. Please remove to checkout.</div>';
            stockError = true;
        } else if (item.quantity > p.stock) {
            stockWarningHtml = `<div class="text-warning" style="font-size:12px; font-weight:600; margin-top:6px;"><i class="fas fa-exclamation-triangle"></i> Insufficient stock. Only ${p.stock} available.</div>`;
            stockError = true;
        }
        
        row.innerHTML = `
            <div class="cart-item-img-box">
                <img src="${p.image_url}" alt="${p.name}" class="cart-item-img" onerror="this.src='/static/images/bager_logo.png'">
            </div>
            <div class="cart-item-details">
                <a href="#/product/${p.id}" class="cart-item-name">${p.name}</a>
                <span class="cart-item-category">${p.category}</span>
                <div class="cart-item-pricing">
                    <span class="current">₹${p.price.toLocaleString('en-IN')}</span>
                    <span class="original">₹${Math.round(p.price * 1.25).toLocaleString('en-IN')}</span>
                    <span class="discount">20% off</span>
                </div>
                ${stockWarningHtml}
                <div class="cart-item-actions">
                    <div class="quantity-selector">
                        <button class="qty-btn dec-btn" onclick="updateCartQuantity(${p.id}, ${item.quantity - 1})">-</button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn inc-btn" onclick="updateCartQuantity(${p.id}, ${item.quantity + 1})">+</button>
                    </div>
                    <button class="cart-remove-item-btn" onclick="removeFromCart(${p.id})">REMOVE</button>
                </div>
            </div>
        `;
        listContainer.appendChild(row);
    });
    
    updatePriceSummary(subtotal, savings);
    
    // Disable Checkout button if stock errors exist
    const checkoutBtn = document.getElementById('cart-checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.disabled = stockError;
        checkoutBtn.title = stockError ? "Please resolve stock issues before checking out" : "";
    }
}

function updatePriceSummary(subtotal, savings) {
    const itemCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    
    document.getElementById('cart-header-count').textContent = itemCount;
    document.getElementById('summary-item-count').textContent = itemCount;
    
    // Subtotal showing the original price level
    const originalTotal = subtotal + savings;
    document.getElementById('summary-subtotal').textContent = `₹${Math.round(originalTotal).toLocaleString('en-IN')}`;
    document.getElementById('summary-discount').textContent = `-₹${Math.round(savings).toLocaleString('en-IN')}`;
    document.getElementById('summary-total').textContent = `₹${subtotal.toLocaleString('en-IN')}`;
}

// --- Render Checkout View ---
function loadCheckoutView() {
    const summaryTarget = document.getElementById('checkout-summary-target');
    if (!summaryTarget) return;
    
    let subtotal = 0;
    let itemsHtml = '';
    
    state.cart.forEach(item => {
        const p = state.products.find(prod => prod.id === item.product_id);
        if (!p) return;
        subtotal += p.price * item.quantity;
        itemsHtml += `
            <div class="checkout-summary-item">
                <span>${p.name} (x${item.quantity})</span>
                <span>₹${(p.price * item.quantity).toLocaleString('en-IN')}</span>
            </div>
        `;
    });
    
    summaryTarget.innerHTML = `
        <div class="checkout-items-summary">
            <h3>Order Summary</h3>
            <div class="checkout-summary-items-list">
                ${itemsHtml}
            </div>
            <hr class="divider">
            <div class="price-row total-row">
                <strong>Total Amount</strong>
                <strong>₹${subtotal.toLocaleString('en-IN')}</strong>
            </div>
        </div>
    `;
}

// --- Confirm / Place Order ---
function handlePlaceOrder() {
    const address = document.getElementById('checkout-address').value.trim();
    if (!address) {
        showToast("Please enter a valid shipping address", "error");
        return;
    }
    
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    
    // Prepare items list
    const orderItems = state.cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
    }));
    
    fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shipping_address: address,
            payment_method: paymentMethod,
            items: orderItems
        })
    })
    .then(async res => {
        const data = await res.json();
        if (res.ok) {
            showToast("Order placed successfully! Thank you for shopping with BAGER.");
            state.cart = [];
            saveCart();
            
            // Refresh products in catalog to sync new stocks
            fetch('/api/products')
                .then(r => r.json())
                .then(prods => state.products = prods);
                
            window.location.hash = '#/orders';
        } else {
            showToast(data.error || "Failed to place order.", "error");
        }
    })
    .catch(err => {
        console.error(err);
        showToast("Network error. Could not place order.", "error");
    });
}

// --- Render User Orders View ---
function loadOrdersView() {
    const list = document.getElementById('user-orders-list');
    if (!list) return;
    
    list.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Fetching your orders...</div>';
    
    fetch('/api/orders')
        .then(res => res.json())
        .then(orders => {
            list.innerHTML = '';
            
            if (orders.length === 0) {
                list.innerHTML = '<div class="loading-spinner">You have not placed any orders yet.</div>';
                return;
            }
            
            orders.forEach(o => {
                const card = document.createElement('div');
                card.className = 'order-card';
                
                const dateStr = new Date(o.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                
                let statusClass = o.status.toLowerCase();
                let itemsHtml = '';
                
                o.items.forEach(item => {
                    itemsHtml += `
                        <div class="order-item-detail-row">
                            <div class="order-item-img-thumbnail">
                                <img src="${item.image_url}" alt="${item.product_name}" onerror="this.src='/static/images/bager_logo.png'">
                            </div>
                            <div class="order-item-text-info">
                                <a href="#/product/${item.product_id}" class="order-item-name-link">${item.product_name}</a>
                                <span class="order-item-qty-price">Quantity: ${item.quantity} | Price: ₹${item.price.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    `;
                });
                
                card.innerHTML = `
                    <div class="order-card-header">
                        <div class="order-header-left">
                            <div class="order-header-field">
                                <span>ORDER PLACED</span>
                                <strong>${dateStr}</strong>
                            </div>
                            <div class="order-header-field">
                                <span>TOTAL AMOUNT</span>
                                <strong>₹${o.total_amount.toLocaleString('en-IN')}</strong>
                            </div>
                            <div class="order-header-field">
                                <span>ORDER ID</span>
                                <strong>#BGR-${o.id}</strong>
                            </div>
                        </div>
                        <div class="order-header-field">
                            <span>PAYMENT METHOD</span>
                            <strong>${o.payment_method}</strong>
                        </div>
                    </div>
                    
                    <div class="order-card-body">
                        <div class="order-status-banner">
                            <span class="status-indicator ${statusClass}"></span>
                            <span>Status: ${o.status}</span>
                        </div>
                        <div class="order-items-grid">
                            ${itemsHtml}
                        </div>
                        <div class="divider"></div>
                        <div style="font-size:12px; color:var(--text-muted);">
                            <strong>Shipping Address:</strong> ${o.shipping_address}
                        </div>
                    </div>
                `;
                list.appendChild(card);
            });
        })
        .catch(err => {
            console.error(err);
            list.innerHTML = '<div class="loading-spinner">Error loading orders.</div>';
        });
}

// --- Auth Modal Control ---
function openAuthModal(tab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    
    // Set tab
    const tabLogin = document.getElementById('tab-login-btn');
    const tabSignup = document.getElementById('tab-signup-btn');
    const formLogin = document.getElementById('login-form-wrapper');
    const formSignup = document.getElementById('signup-form-wrapper');
    
    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        formLogin.classList.add('active');
        formSignup.classList.remove('active');
    } else {
        tabLogin.classList.remove('active');
        tabSignup.classList.add('active');
        formLogin.classList.remove('active');
        formSignup.classList.add('active');
    }
    
    // Clear errors
    document.getElementById('login-error-msg').classList.remove('active');
    document.getElementById('signup-error-msg').classList.remove('active');
    
    modal.classList.add('active');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
}

// --- Check Login Session on Load ---
function checkAuthSession() {
    return fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
            updateAuthUI(data.user);
            return data.user;
        });
}

function updateAuthUI(user) {
    state.currentUser = user;
    
    const userNav = document.getElementById('user-nav-area');
    const adminLink = document.getElementById('nav-admin-link');
    const ordersLink = document.getElementById('nav-orders-link');
    const logoutBtn = document.getElementById('nav-logout-btn');
    
    if (user) {
        // Logged in
        userNav.innerHTML = `
            <span class="nav-profile-name" id="user-profile-toggle">
                <i class="fas fa-user-circle"></i>
                <span>Hello, ${user.name.split(' ')[0]}</span>
            </span>
        `;
        
        logoutBtn.classList.remove('hidden');
        ordersLink.classList.remove('hidden');
        
        if (user.role === 'admin') {
            adminLink.classList.remove('hidden');
        } else {
            adminLink.classList.add('hidden');
        }
    } else {
        // Logged out
        userNav.innerHTML = `<button class="login-nav-btn" id="nav-login-btn">Login</button>`;
        
        // Re-bind click listener for the dynamic button
        document.getElementById('nav-login-btn').onclick = () => openAuthModal('login');
        
        adminLink.classList.add('hidden');
        ordersLink.classList.add('hidden');
        logoutBtn.classList.add('hidden');
    }
}

// --- Handle Authentication Form Submissions ---
function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error-msg');
    
    errorMsg.classList.remove('active');
    
    fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(async res => {
        const data = await res.json();
        if (res.ok) {
            updateAuthUI(data.user);
            closeAuthModal();
            showToast(`Welcome back, ${data.user.name}!`);
            router(); // Refresh view state
        } else {
            errorMsg.textContent = data.error;
            errorMsg.classList.add('active');
        }
    })
    .catch(err => {
        errorMsg.textContent = "Network error. Please try again.";
        errorMsg.classList.add('active');
    });
}

function handleSignupSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const errorMsg = document.getElementById('signup-error-msg');
    
    errorMsg.classList.remove('active');
    
    if (password.length < 6) {
        errorMsg.textContent = "Password must be at least 6 characters.";
        errorMsg.classList.add('active');
        return;
    }
    
    if (password !== confirmPassword) {
        errorMsg.textContent = "Passwords do not match.";
        errorMsg.classList.add('active');
        return;
    }
    
    fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    })
    .then(async res => {
        const data = await res.json();
        if (res.ok) {
            updateAuthUI(data.user);
            closeAuthModal();
            showToast("Account created successfully!");
            router();
        } else {
            errorMsg.textContent = data.error;
            errorMsg.classList.add('active');
        }
    })
    .catch(err => {
        errorMsg.textContent = "Network error. Please try again.";
        errorMsg.classList.add('active');
    });
}

function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST' })
        .then(() => {
            updateAuthUI(null);
            showToast("Logged out successfully");
            window.location.hash = '#/';
        });
}

// --- Global Event Initializer ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Checks
    updateCartBadge();
    checkAuthSession().then(() => {
        // Fetch products and trigger router
        fetch('/api/products')
            .then(res => res.json())
            .then(products => {
                state.products = products;
                router();
            });
    });
    
    // 2. Hash Router Listeners
    window.addEventListener('hashchange', router);
    
    // 3. Navigation Header Click Event Bindings
    const navLogin = document.getElementById('nav-login-btn');
    if (navLogin) navLogin.onclick = () => openAuthModal('login');
    
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) logoutBtn.onclick = handleLogout;
    
    // 4. Modal Tab Switchers
    document.getElementById('tab-login-btn').onclick = () => openAuthModal('login');
    document.getElementById('tab-signup-btn').onclick = () => openAuthModal('signup');
    
    // 5. Modal Closes
    document.getElementById('modal-close-btn').onclick = closeAuthModal;
    
    // Close modal on background click
    document.getElementById('auth-modal').onclick = (e) => {
        if (e.target.id === 'auth-modal') closeAuthModal();
    };
    
    // 6. Form submissions
    document.getElementById('login-form').onsubmit = handleLoginSubmit;
    document.getElementById('signup-form').onsubmit = handleSignupSubmit;
    
    // Checkout form button submission
    const confirmOrderBtn = document.getElementById('confirm-order-btn');
    if (confirmOrderBtn) confirmOrderBtn.onclick = handlePlaceOrder;
    
    // 7. Search Form Submission
    document.getElementById('search-form').onsubmit = (e) => {
        e.preventDefault();
        const searchVal = document.getElementById('search-input').value.trim();
        window.location.hash = '#/';
        loadHomeView(null, searchVal);
    };
    
    // 8. Category filter buttons
    document.querySelectorAll('.category-item').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
            const currentBtn = e.currentTarget;
            currentBtn.classList.add('active');
            
            const category = currentBtn.getAttribute('data-category');
            window.location.hash = '#/';
            loadHomeView(category || null);
        };
    });
    
    // 9. Checkout Nav from Cart
    const checkoutCartBtn = document.getElementById('cart-checkout-btn');
    if (checkoutCartBtn) {
        checkoutCartBtn.onclick = () => {
            window.location.hash = '#/checkout';
        };
    }
});

// Export globals for use across scripts
window.appState = state;
window.appShowToast = showToast;
window.appOpenAuthModal = openAuthModal;
