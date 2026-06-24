import sqlite3
import os
import json
import functools
from flask import Flask, request, jsonify, session, render_template

app = Flask(__name__, template_folder='templates', static_folder='static')
# 👇 ADD THIS BLOCK HERE
def init_db():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT
    )
    """)

    # If you have products, also add this:
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        image TEXT
    )
    """)

    conn.commit()
    conn.close()

init_db()  # 👈 THIS LINE IS IMPORTANT
app.secret_key = os.environ.get('SECRET_KEY', 'bager_ecomm_secure_key_987654321')

# On Render, use /data/ (persistent disk). Locally use the project directory.
_DATA_DIR = '/data' if os.path.isdir('/data') else os.path.dirname(__file__)
DATABASE_PATH = os.path.join(_DATA_DIR, 'database.db')
def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Helper decorators
def login_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Unauthorized. Please log in."}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Unauthorized. Please log in."}), 401
        if session.get('role') != 'admin':
            return jsonify({"error": "Forbidden. Admin access required."}), 403
        return f(*args, **kwargs)
    return decorated_function

# --- Frontend Serving Routes ---
@app.route('/')
def index():
    return render_template('index.html')

# --- API Routes ---

# User Authentication
from werkzeug.security import generate_password_hash, check_password_hash

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400
        
    pw_hash = generate_password_hash(password, method="pbkdf2:sha256")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'user')",
            (name, email, pw_hash)
        )
        conn.commit()
        
        # Get the new user info to log them in directly
        user_id = cursor.lastrowid
        session['user_id'] = user_id
        session['name'] = name
        session['email'] = email
        session['role'] = 'user'
        
        return jsonify({
            "message": "User registered successfully",
            "user": {"id": user_id, "name": name, "email": email, "role": "user"}
        }), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email address already registered"}), 400
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
        
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({"error": "Invalid email or password"}), 401
        
    session['user_id'] = user['id']
    session['name'] = user['name']
    session['email'] = user['email']
    session['role'] = user['role']
    
    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user['id'],
            "name": user['name'],
            "email": user['email'],
            "role": user['role']
        }
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"})

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    if 'user_id' not in session:
        return jsonify({"user": None})
    return jsonify({
        "user": {
            "id": session['user_id'],
            "name": session['name'],
            "email": session['email'],
            "role": session['role']
        }
    })

# Products API
@app.route('/api/products', methods=['GET'])
def get_products():
    category = request.args.get('category')
    search = request.args.get('search')
    stock_status = request.args.get('stock') # e.g. "low" or "out"
    
    query = "SELECT * FROM products WHERE 1=1"
    params = []
    
    if category:
        query += " AND category = ?"
        params.append(category)
    if search:
        query += " AND (name LIKE ? OR description LIKE ?)"
        params.append(f"%{search}%")
        params.append(f"%{search}%")
    if stock_status == 'low':
        query += " AND stock <= 5 AND stock > 0"
    elif stock_status == 'out':
        query += " AND stock = 0"
        
    query += " ORDER BY id DESC"
    
    conn = get_db_connection()
    products = conn.execute(query, params).fetchall()
    conn.close()
    
    result = []
    for p in products:
        result.append({
            "id": p['id'],
            "name": p['name'],
            "category": p['category'],
            "price": p['price'],
            "stock": p['stock'],
            "image_url": p['image_url'],
            "description": p['description'],
            "specs": json.loads(p['specs']) if p['specs'] else {}
        })
    return jsonify(result)

@app.route('/api/products', methods=['POST'])
def add_product():
    # Only allow logged-in users to proceed
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized. Please log in."}), 401
    
    # Custom check instead of @admin_required to handle mock environment during local testing/dev
    if session.get('role') != 'admin':
        return jsonify({"error": "Forbidden. Admin access required."}), 403

    data = request.get_json() or {}
    name = data.get('name')
    category = data.get('category')
    price = data.get('price')
    stock = data.get('stock')
    image_url = data.get('image_url') or "/static/images/prod_shoes.png"
    description = data.get('description') or ""
    specs = data.get('specs') or {}
    
    if not name or not category or price is None or stock is None:
        return jsonify({"error": "Name, category, price, and stock are required"}), 400
        
    try:
        price = float(price)
        stock = int(stock)
    except ValueError:
        return jsonify({"error": "Price must be a number and stock must be an integer"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO products (name, category, price, stock, image_url, description, specs)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (name, category, price, stock, image_url, description, json.dumps(specs)))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    
    return jsonify({
        "message": "Product added successfully",
        "product": {
            "id": new_id,
            "name": name,
            "category": category,
            "price": price,
            "stock": stock,
            "image_url": image_url,
            "description": description,
            "specs": specs
        }
    }), 201

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@admin_required
def update_product(product_id):
    data = request.get_json() or {}
    
    conn = get_db_connection()
    product = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not product:
        conn.close()
        return jsonify({"error": "Product not found"}), 404
        
    name = data.get('name', product['name'])
    category = data.get('category', product['category'])
    price = data.get('price')
    stock = data.get('stock')
    image_url = data.get('image_url', product['image_url'])
    description = data.get('description', product['description'])
    specs = data.get('specs')
    
    if price is None:
        price = product['price']
    if stock is None:
        stock = product['stock']
        
    try:
        price = float(price)
        stock = int(stock)
    except ValueError:
        conn.close()
        return jsonify({"error": "Price must be a number and stock must be an integer"}), 400
        
    specs_str = json.dumps(specs) if specs is not None else product['specs']
    
    conn.execute('''
        UPDATE products 
        SET name = ?, category = ?, price = ?, stock = ?, image_url = ?, description = ?, specs = ?
        WHERE id = ?
    ''', (name, category, price, stock, image_url, description, specs_str, product_id))
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Product updated successfully"})

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@admin_required
def delete_product(product_id):
    conn = get_db_connection()
    product = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not product:
        conn.close()
        return jsonify({"error": "Product not found"}), 404
        
    conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Product deleted successfully"})

# Orders API
@app.route('/api/orders', methods=['POST'])
@login_required
def place_order():
    data = request.get_json() or {}
    shipping_address = data.get('shipping_address')
    payment_method = data.get('payment_method')
    items = data.get('items') # Expect list of {"product_id": x, "quantity": y}
    
    if not shipping_address or not payment_method or not items:
        return jsonify({"error": "Shipping address, payment method, and items are required"}), 400
        
    conn = get_db_connection()
    conn.execute("BEGIN TRANSACTION")
    cursor = conn.cursor()
    
    try:
        total_amount = 0
        order_items_to_insert = []
        
        # Verify stock and calculate total first
        for item in items:
            p_id = item.get('product_id')
            qty = item.get('quantity')
            
            if not p_id or not qty or int(qty) <= 0:
                conn.rollback()
                conn.close()
                return jsonify({"error": "Invalid item or quantity"}), 400
                
            qty = int(qty)
            product = cursor.execute("SELECT * FROM products WHERE id = ?", (p_id,)).fetchone()
            
            if not product:
                conn.rollback()
                conn.close()
                return jsonify({"error": f"Product with ID {p_id} not found"}), 404
                
            if product['stock'] < qty:
                conn.rollback()
                conn.close()
                return jsonify({"error": f"Insufficient stock for {product['name']}. Available: {product['stock']}"}), 400
                
            item_total = product['price'] * qty
            total_amount += item_total
            
            order_items_to_insert.append({
                "product_id": p_id,
                "quantity": qty,
                "price": product['price'],
                "new_stock": product['stock'] - qty
            })
            
        # Create order record
        cursor.execute('''
            INSERT INTO orders (user_id, shipping_address, payment_method, total_amount, status)
            VALUES (?, ?, ?, ?, 'Pending')
        ''', (session['user_id'], shipping_address, payment_method, total_amount))
        order_id = cursor.lastrowid
        
        # Insert items and decrement stock
        for item in order_items_to_insert:
            cursor.execute('''
                INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
                VALUES (?, ?, ?, ?)
            ''', (order_id, item['product_id'], item['quantity'], item['price']))
            
            cursor.execute('''
                UPDATE products SET stock = ? WHERE id = ?
            ''', (item['new_stock'], item['product_id']))
            
        conn.commit()
        conn.close()
        return jsonify({
            "message": "Order placed successfully",
            "order_id": order_id,
            "total_amount": total_amount
        }), 201
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": f"Failed to place order: {str(e)}"}), 500

@app.route('/api/orders', methods=['GET'])
@login_required
def get_orders():
    conn = get_db_connection()
    role = session.get('role')
    user_id = session.get('user_id')
    
    if role == 'admin':
        # Admin gets all orders with user info
        orders = conn.execute('''
            SELECT o.*, u.name as user_name, u.email as user_email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        ''').fetchall()
    else:
        # User gets only their own orders
        orders = conn.execute('''
            SELECT o.*, u.name as user_name, u.email as user_email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
        ''', (user_id,)).fetchall()
        
    result = []
    for order in orders:
        items = conn.execute('''
            SELECT oi.*, p.name as product_name, p.image_url
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        ''', (order['id'],)).fetchall()
        
        items_list = []
        for item in items:
            items_list.append({
                "id": item['id'],
                "product_id": item['product_id'],
                "product_name": item['product_name'],
                "image_url": item['image_url'],
                "quantity": item['quantity'],
                "price": item['price_at_purchase']
            })
            
        result.append({
            "id": order['id'],
            "shipping_address": order['shipping_address'],
            "payment_method": order['payment_method'],
            "total_amount": order['total_amount'],
            "status": order['status'],
            "created_at": order['created_at'],
            "user_name": order['user_name'],
            "user_email": order['user_email'],
            "items": items_list
        })
        
    conn.close()
    return jsonify(result)

# Admin stats API
@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def get_admin_stats():
    conn = get_db_connection()
    
    # 1. Total sales (sum of total_amount from completed/shipped/pending orders)
    sales = conn.execute("SELECT SUM(total_amount) FROM orders WHERE status != 'Cancelled'").fetchone()[0] or 0.0
    
    # 2. Total orders count
    orders_count = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0] or 0
    
    # 3. Total products count
    products_count = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0] or 0
    
    # 4. Low stock items (stock <= 5)
    low_stock_count = conn.execute("SELECT COUNT(*) FROM products WHERE stock <= 5").fetchone()[0] or 0
    
    conn.close()
    
    return jsonify({
        "total_sales": round(sales, 2),
        "total_orders": orders_count,
        "total_products": products_count,
        "low_stock_products": low_stock_count
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001)
