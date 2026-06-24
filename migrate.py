import os
from dotenv import load_dotenv

load_dotenv('backend/.env')

import sys
sys.path.append('backend')
from app import db

print("Starting migration...")

try:
    db.execute_query("ALTER TABLE members ADD COLUMN latitude DECIMAL(10,8) NULL", commit=True)
    db.execute_query("ALTER TABLE members ADD COLUMN longitude DECIMAL(11,8) NULL", commit=True)
except Exception as e:
    print(f"Members table already altered or error: {e}")

try:
    db.execute_query("ALTER TABLE medication_logs MODIFY COLUMN status ENUM('pending', 'triggered', 'snoozed', 'taken', 'missed', 'cancelled') NOT NULL", commit=True)
    db.execute_query("ALTER TABLE medication_logs ADD COLUMN snoozed_until DATETIME NULL", commit=True)
except Exception as e:
    print(f"Medication logs already altered or error: {e}")

print("Migration done!")
