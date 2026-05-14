import sqlite3
import os

db_path = 'shift_db.db'

def fix_schema():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if emp_id column exists
    cursor.execute("PRAGMA table_info(employees)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'emp_id' not in columns:
        print("Adding emp_id column to employees table...")
        cursor.execute("ALTER TABLE employees ADD COLUMN emp_id TEXT")
        # Initialize unique index if needed, but for now just adding is enough
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_employees_emp_id ON employees (emp_id)")
    else:
        print("emp_id column already exists.")
        
    conn.commit()
    conn.close()
    print("Database schema fix complete.")

if __name__ == "__main__":
    if os.path.exists(db_path):
        fix_schema()
    else:
        print(f"Database file {db_path} not found.")
