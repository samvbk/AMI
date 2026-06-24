# test_db.py
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

print("🔍 Testing MySQL Connection...")
print("=" * 50)

try:
    # Try to connect
    conn = mysql.connector.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'healthcare'),
        port=int(os.getenv('DB_PORT', 3306))
    )
    
    cursor = conn.cursor()
    
    # Check if database exists
    cursor.execute("SELECT DATABASE()")
    db_name = cursor.fetchone()[0]
    print(f"✅ Connected to database: {db_name}")
    
    # Check tables
    cursor.execute("SHOW TABLES")
    tables = cursor.fetchall()
    if tables:
        print(f"✅ Found tables: {', '.join([t[0] for t in tables])}")
    else:
        print("⚠️ No tables found. Creating tables...")
        
        # Create tables
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS families (
                id INT AUTO_INCREMENT PRIMARY KEY,
                family_name VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                family_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                role VARCHAR(50) NOT NULL,
                age INT,
                face_encoding LONGBLOB,
                medical_history TEXT,
                emergency_contact VARCHAR(20),
                last_seen TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                member_id INT NOT NULL,
                message TEXT NOT NULL,
                response TEXT,
                emotion VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
            )
        """)
        
        conn.commit()
        print("✅ Tables created successfully!")
    
    cursor.close()
    conn.close()
    print("✅ Connection test passed!")
    
except mysql.connector.Error as e:
    print(f"❌ MySQL Error: {e}")
    print("\nTroubleshooting steps:")
    print("1. Make sure MySQL is running: brew services start mysql")
    print("2. Check if you can login: mysql -u root -p")
    print("3. If you forgot password, reset it: mysql_secure_installation")
except Exception as e:
    print(f"❌ Error: {e}")

print("=" * 50)
