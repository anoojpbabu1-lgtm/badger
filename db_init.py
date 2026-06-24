import sqlite3
import os
import json
from werkzeug.security import generate_password_hash

# On Render, use /data/ (persistent disk). Locally use the project directory.
_DATA_DIR = '/data' if os.path.isdir('/data') else os.path.dirname(__file__)
DATABASE_PATH = os.path.join(_DATA_DIR, 'database.db')

def init_db():
    print(f"Initializing database at: {DATABASE_PATH}")
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Create Users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create Products table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        description TEXT NOT NULL,
        specs TEXT NOT NULL, -- JSON string
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create Orders table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        shipping_address TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    ''')
    
    # Create Order Items table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price_at_purchase REAL NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES products(id)
    )
    ''')
    
    # Seed Admin and User
    # Default Admin Password: alpha123
    admin_pw = generate_password_hash("alpha123", method="pbkdf2:sha256")
    user_pw = generate_password_hash("user123", method="pbkdf2:sha256")
    
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
        ''', ("System Admin", "admin@bager.com", admin_pw, "admin"))
        
        cursor.execute('''
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
        ''', ("John Doe", "user@bager.com", user_pw, "user"))
        print("Seeded default users (Admin: admin@bager.com / alpha123, User: user@bager.com / user123)")
    
    # Seed Products
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        products = [
            (
                "BAGER Neo 5G", 
                "Electronics", 
                15499.00, 
                15, 
                "/static/images/prod_phone.png",
                "Experience blazing fast speeds with the BAGER Neo 5G, featuring a 6.7 inch AMOLED display, 108MP triple camera setup, and a massive 5000mAh battery.",
                json.dumps({"RAM": "8 GB", "Storage": "128 GB", "Processor": "Octa Core 2.8GHz", "Display": "6.7 inch FHD+ AMOLED", "Battery": "5000 mAh"})
            ),
            (
                "BAGER Book Air", 
                "Electronics", 
                45999.00, 
                8, 
                "/static/images/prod_laptop.png",
                "Lightweight power meets stunning design. BAGER Book Air comes with the latest processor, 16GB RAM, and a super-fast 512GB SSD for all your multitasking needs.",
                json.dumps({"RAM": "16 GB", "Storage": "512 GB SSD", "Processor": "Intel i5 11th Gen", "Display": "14 inch IPS QHD", "Weight": "1.2 kg"})
            ),
            (
                "BAGER Fit Active", 
                "Smart Devices", 
                2499.00, 
                25, 
                "/static/images/prod_watch.png",
                "Track your fitness and stay connected with the BAGER Fit Active smartwatch. Includes heart rate monitor, SpO2 sensor, sleep tracker, and a 10-day battery life.",
                json.dumps({"Display": "1.43 inch AMOLED", "Waterproof": "IP68 Rated", "Sensors": "Heart Rate, SpO2", "Battery Life": "Up to 10 Days"})
            ),
            (
                "BAGER SoundWave Pro", 
                "Smart Devices", 
                4999.00, 
                12, 
                "/static/images/prod_headphones.png",
                "Immerse yourself in pure sound with hybrid Active Noise Cancellation. BAGER SoundWave Pro offers deep bass, crystal clear highs, and up to 40 hours of playtime.",
                json.dumps({"Type": "Over-Ear", "ANC": "Yes (Hybrid)", "Battery Life": "40 hours", "Bluetooth": "v5.2"})
            ),
            (
                "BAGER Flyknit Rosso", 
                "Footwear", 
                1899.00, 
                30, 
                "/static/images/prod_shoes.png",
                "Step into comfort and style with the Flyknit Rosso. Designed with breathable mesh upper and a soft responsive cushion sole, perfect for daily running and workouts.",
                json.dumps({"Material": "Breathable Mesh", "Sole": "Eva Cushioning", "Color": "Crimson Red", "Type": "Sports/Running"})
            )
        ]
        cursor.executemany('''
        INSERT INTO products (name, category, price, stock, image_url, description, specs)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', products)
        print(f"Seeded {len(products)} initial products.")
        
    conn.commit()
    conn.close()
    print("Database initialization complete.")

if __name__ == '__main__':
    init_db()
