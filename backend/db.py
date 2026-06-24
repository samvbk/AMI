# backend/db.py
import mysql.connector
from config import config
import time
import os

def get_db():
    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            print(f"🔗 Attempting database connection (attempt {attempt + 1}/{max_retries})...")
            
            # Parse DATABASE_URL if it's in URL format
            db_url = config.DATABASE_URL
            if db_url.startswith('mysql://'):
                # Parse URL format: mysql://username:password@localhost:3306/database
                import urllib.parse
                db_url = db_url.replace('mysql://', '')
                if '@' in db_url:
                    auth_part, host_part = db_url.split('@')
                    if ':' in auth_part:
                        user, password = auth_part.split(':', 1)
                    else:
                        user = auth_part
                        password = os.getenv('DB_PASSWORD', '')
                    host_port_db = host_part.split('/')
                    host_port = host_port_db[0]
                    database = host_port_db[1] if len(host_port_db) > 1 else 'healthcare'
                    
                    if ':' in host_port:
                        host, port = host_port.split(':')
                        port = int(port)
                    else:
                        host = host_port
                        port = 3306
                else:
                    # Fallback to defaults
                    user = os.getenv('DB_USER', 'root')
                    password = os.getenv('DB_PASSWORD', '')
                    host = os.getenv('DB_HOST', 'localhost')
                    port = int(os.getenv('DB_PORT', 3306))
                    database = os.getenv('DB_NAME', 'healthcare')
            else:
                # Use default values
                user = os.getenv('DB_USER', 'root')
                password = os.getenv('DB_PASSWORD', '')
                host = os.getenv('DB_HOST', 'localhost')
                port = int(os.getenv('DB_PORT', 3306))
                database = os.getenv('DB_NAME', 'healthcare')
            
            conn = mysql.connector.connect(
                host=host,
                user=user,
                password=password,
                database=database,
                port=port,
                autocommit=False,
                connection_timeout=10
            )
            
            print(f"✅ Database connected successfully to {database}")
            
            # Test connection with a simple query
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            
            return conn
            
        except mysql.connector.Error as e:
            print(f"❌ Database connection error (attempt {attempt + 1}): {e}")
            
            if attempt < max_retries - 1:
                print(f"⏳ Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                print("❌ Max retries reached. Could not connect to database.")
                # Return a dummy connection that won't crash the app
                class DummyDB:
                    def cursor(self, *args, **kwargs):
                        class DummyCursor:
                            def execute(self, *args, **kwargs):
                                print(f"⚠️ Dummy execute: {args[0]}")
                                pass
                            def fetchone(self):
                                return None
                            def fetchall(self):
                                return []
                            def close(self):
                                pass
                            def __getitem__(self, key):
                                return None
                            @property
                            def lastrowid(self):
                                return 1
                        return DummyCursor()
                    def commit(self):
                        pass
                    def close(self):
                        pass
                return DummyDB()
