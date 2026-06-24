// BAGER Admin Dashboard Logic
// Product CRUD, stock management, order lists, metrics loading, specs rows

let activeAdminPanel = 'admin-stats-panel';
let specsCount = 0;

// --- Load Admin Stats ---
function loadAdminStats() {
    fetch('/api/admin/stats')
        .then(res => {
            if (!res.ok) throw new Error("Not authorized");
            return res.json();
        })
        .then(stats => {
            document.getElementById('stat-total-sales').textContent = `₹${stats.total_sales.toLocaleString('en-IN')}`;
            document.getElementById('stat-total-orders').textContent = stats.total_orders;
            document.getElementById('stat-total-products').textContent = stats.total_products;
            document.getElementById('stat-low-stock').textContent = stats.low_stock_products;
        })
        .catch(err => console.error("Error loading admin stats:", err));
}

// --- Load Products Table ---
function loadAdminProducts() {
    const tbody = document.getElementById('admin-products-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
    
    fetch('/api/products')
        .then(res => res.json())
        .then(products => {
            tbody.innerHTML = '';
            
            if (products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No products found.</td></tr>';
                return;
            }
            
            products.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.id}</td>
                    <td>
                        <img src="${p.image_url}" alt="${p.name}" class="admin-table-img" onerror="this.src='/static/images/bager_logo.png'">
                    </td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.category}</td>
                    <td>₹${p.price.toLocaleString('en-IN')}</td>
                    <td>
                        <span class="status-badge ${p.stock === 0 ? 'cancelled' : p.stock <= 5 ? 'pending' : 'delivered'}" style="text-transform:none;">
                            ${p.stock} units
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-secondary" onclick="openEditProductModal(${p.id})" style="padding: 6px 12px; font-size:12px;">Edit</button>
                        <button class="btn btn-danger" onclick="deleteProduct(${p.id})" style="padding: 6px 12px; font-size:12px;">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Failed to load products.</td></tr>';
        });
}

// --- Delete Product ---
function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    
    fetch(`/api/products/${id}`, { method: 'DELETE' })
        .then(async res => {
            const data = await res.json();
            if (res.ok) {
                window.appShowToast("Product deleted successfully");
                loadAdminProducts();
                loadAdminStats();
                // Refresh main app state products list
                fetch('/api/products')
                    .then(r => r.json())
                    .then(prods => window.appState.products = prods);
            } else {
                window.appShowToast(data.error || "Delete failed", "error");
            }
        })
        .catch(err => {
            console.error(err);
            window.appShowToast("Delete operation failed", "error");
        });
}

// --- Load Admin Orders Table ---
function loadAdminOrders() {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading orders...</td></tr>';
    
    fetch('/api/orders')
        .then(res => res.json())
        .then(orders => {
            tbody.innerHTML = '';
            
            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No customer orders placed yet.</td></tr>';
                return;
            }
            
            orders.forEach(o => {
                const tr = document.createElement('tr');
                const dateStr = new Date(o.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });
                
                // Build items list
                let itemsList = '';
                o.items.forEach(item => {
                    itemsList += `<div>• ${item.product_name} (x${item.quantity})</div>`;
                });
                
                const statusClass = o.status.toLowerCase();
                
                tr.innerHTML = `
                    <td><strong>#BGR-${o.id}</strong></td>
                    <td>
                        <div class="admin-order-customer">
                            <strong>${o.user_name}</strong>
                            <span>${o.user_email}</span>
                            <span style="font-size:10px; color:#555;">Addr: ${o.shipping_address}</span>
                        </div>
                    </td>
                    <td>${dateStr}</td>
                    <td>${itemsList}</td>
                    <td>₹${o.total_amount.toLocaleString('en-IN')}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${o.status}</span>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Failed to load orders.</td></tr>';
        });
}

// --- Specifications Dynamic Rows Helpers ---
function addSpecRow(key = '', val = '') {
    const list = document.getElementById('specs-input-list');
    if (!list) return;
    
    const rowId = `spec-row-${specsCount++}`;
    const row = document.createElement('div');
    row.className = 'specs-input-row';
    row.id = rowId;
    
    row.innerHTML = `
        <input type="text" class="spec-key" placeholder="Key (e.g. RAM)" value="${key}" required>
        <input type="text" class="spec-val" placeholder="Value (e.g. 8 GB)" value="${val}" required>
        <button type="button" class="remove-spec-row-btn" onclick="document.getElementById('${rowId}').remove()" title="Remove spec">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;
    list.appendChild(row);
}

function getSpecsMap() {
    const specs = {};
    document.querySelectorAll('.specs-input-row').forEach(row => {
        const key = row.querySelector('.spec-key').value.trim();
        const val = row.querySelector('.spec-val').value.trim();
        if (key && val) {
            specs[key] = val;
        }
    });
    return specs;
}

// --- Product Modal Controls ---
function openAddProductModal() {
    const form = document.getElementById('product-form');
    form.reset();
    document.getElementById('prod-form-id').value = '';
    document.getElementById('specs-input-list').innerHTML = '';
    document.getElementById('product-modal-title').textContent = "Add New Product";
    document.getElementById('prod-form-error-msg').classList.remove('active');
    
    // Seed default spec rows
    addSpecRow("Brand", "BAGER");
    
    document.getElementById('product-modal').classList.add('active');
}

function openEditProductModal(id) {
    const form = document.getElementById('product-form');
    form.reset();
    document.getElementById('prod-form-id').value = id;
    document.getElementById('product-modal-title').textContent = "Edit Product";
    document.getElementById('prod-form-error-msg').classList.remove('active');
    
    const p = window.appState.products.find(item => item.id === id);
    if (!p) return;
    
    document.getElementById('prod-form-name').value = p.name;
    document.getElementById('prod-form-category').value = p.category;
    document.getElementById('prod-form-price').value = p.price;
    document.getElementById('prod-form-stock').value = p.stock;
    document.getElementById('prod-form-image').value = p.image_url;
    document.getElementById('prod-form-desc').value = p.description;
    
    const specsList = document.getElementById('specs-input-list');
    specsList.innerHTML = '';
    if (p.specs && Object.keys(p.specs).length > 0) {
        for (const [key, val] of Object.entries(p.specs)) {
            addSpecRow(key, val);
        }
    } else {
        addSpecRow("Brand", "BAGER");
    }
    
    document.getElementById('product-modal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
}

// --- Product Form Submit Handler ---
function handleProductFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('prod-form-id').value;
    const name = document.getElementById('prod-form-name').value;
    const category = document.getElementById('prod-form-category').value;
    const price = document.getElementById('prod-form-price').value;
    const stock = document.getElementById('prod-form-stock').value;
    const image_url = document.getElementById('prod-form-image').value;
    const description = document.getElementById('prod-form-desc').value;
    const specs = getSpecsMap();
    
    const errorMsg = document.getElementById('prod-form-error-msg');
    errorMsg.classList.remove('active');
    
    const payload = { name, category, price, stock, image_url, description, specs };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/products/${id}` : '/api/products';
    
    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(async res => {
        const data = await res.json();
        if (res.ok) {
            window.appShowToast(id ? "Product updated successfully" : "Product added successfully");
            closeProductModal();
            loadAdminProducts();
            loadAdminStats();
            
            // Sync products list in main app state
            fetch('/api/products')
                .then(r => r.json())
                .then(prods => window.appState.products = prods);
        } else {
            errorMsg.textContent = data.error || "Failed to save product.";
            errorMsg.classList.add('active');
        }
    })
    .catch(err => {
        console.error(err);
        errorMsg.textContent = "Network error. Please try again.";
        errorMsg.classList.add('active');
    });
}

// --- Load Admin Panel ---
function loadAdminDashboard() {
    loadAdminStats();
    
    // Load whichever panel is active
    if (activeAdminPanel === 'admin-stats-panel') {
        loadAdminStats();
    } else if (activeAdminPanel === 'admin-products-panel') {
        loadAdminProducts();
    } else if (activeAdminPanel === 'admin-orders-panel') {
        loadAdminOrders();
    }
}

// --- Initializer ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Tab Switching Listeners
    document.querySelectorAll('.admin-menu-item').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.admin-menu-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
            
            const currentBtn = e.currentTarget;
            currentBtn.classList.add('active');
            
            const targetPanel = currentBtn.getAttribute('data-panel');
            document.getElementById(targetPanel).classList.add('active');
            activeAdminPanel = targetPanel;
            
            loadAdminDashboard();
        };
    });
    
    // 2. Add product click
    const addProductBtn = document.getElementById('admin-add-product-btn');
    if (addProductBtn) addProductBtn.onclick = openAddProductModal;
    
    // 3. Add spec row click
    const addSpecBtn = document.getElementById('add-spec-row-btn');
    if (addSpecBtn) addSpecBtn.onclick = () => addSpecRow();
    
    // 4. Modal cancels / closes
    const closeBtn = document.getElementById('prod-modal-close-btn');
    if (closeBtn) closeBtn.onclick = closeProductModal;
    
    const cancelBtn = document.getElementById('prod-form-cancel-btn');
    if (cancelBtn) cancelBtn.onclick = closeProductModal;
    
    document.getElementById('product-modal').onclick = (e) => {
        if (e.target.id === 'product-modal') closeProductModal();
    };
    
    // 5. Submit handler
    document.getElementById('product-form').onsubmit = handleProductFormSubmit;
});

// Bind globals for inline HTML onClick listeners
window.loadAdminDashboard = loadAdminDashboard;
window.openEditProductModal = openEditProductModal;
window.deleteProduct = deleteProduct;
