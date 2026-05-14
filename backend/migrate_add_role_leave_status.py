"""
Migration script to add 'role' and 'leave_status' columns to employees table
"""
import sqlite3
import os

DB_PATH = "shift_db_new.db"

def migrate():
    print("\n" + "="*60)
    print("DATABASE MIGRATION: Adding role and leave_status columns")
    print("="*60)
    
    if not os.path.exists(DB_PATH):
        print(f"✗ Database not found: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(employees)")
        columns = [col[1] for col in cursor.fetchall()]
        print(f"\nCurrent columns: {columns}")
        
        # Add 'role' column if it doesn't exist
        if 'role' not in columns:
            print("\n➕ Adding 'role' column...")
            cursor.execute("ALTER TABLE employees ADD COLUMN role VARCHAR(100) DEFAULT 'Staff'")
            print("✓ 'role' column added")
        else:
            print("\n✓ 'role' column already exists")
        
        # Add 'leave_status' column if it doesn't exist
        if 'leave_status' not in columns:
            print("\n➕ Adding 'leave_status' column...")
            cursor.execute("ALTER TABLE employees ADD COLUMN leave_status VARCHAR(50) DEFAULT 'Present'")
            print("✓ 'leave_status' column added")
        else:
            print("\n✓ 'leave_status' column already exists")
        
        # Set default values for existing records
        print("\n🔄 Setting default values for existing records...")
        cursor.execute("UPDATE employees SET role = 'Staff' WHERE role IS NULL")
        cursor.execute("UPDATE employees SET leave_status = 'Present' WHERE leave_status IS NULL")
        
        conn.commit()
        
        # Verify
        cursor.execute("PRAGMA table_info(employees)")
        columns = [col[1] for col in cursor.fetchall()]
        print(f"\n✅ Updated columns: {columns}")
        
        # Show sample data
        cursor.execute("SELECT emp_id, name, role, leave_status FROM employees LIMIT 5")
        rows = cursor.fetchall()
        print(f"\n📊 Sample data:")
        for row in rows:
            print(f"   {row[0]} - {row[1]} | Role: {row[2]} | Leave Status: {row[3]}")
        
        print("\n" + "="*60)
        print("MIGRATION COMPLETE")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n✗ Migration failed: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
