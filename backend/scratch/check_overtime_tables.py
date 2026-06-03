import os
import sqlite3

def check_db():
    root_db = os.path.abspath("shift_db_new.db")
    backend_db = os.path.abspath("backend/shift_db_new.db")
    
    paths = {
        "Root Database": root_db,
        "Backend Database": backend_db
    }
    
    for label, path in paths.items():
        print(f"\n=== Checking {label} at {path} ===")
        if not os.path.exists(path):
            print("File does not exist!")
            continue
            
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        
        # Check employees
        try:
            cursor.execute("SELECT COUNT(*) FROM employees")
            emp_count = cursor.fetchone()[0]
            print(f"Employees count: {emp_count}")
        except Exception as e:
            print("Error querying employees:", e)
            
        # Check overtimes
        try:
            cursor.execute("SELECT COUNT(*) FROM overtimes")
            ot_count = cursor.fetchone()[0]
            print(f"Overtimes count: {ot_count}")
        except Exception as e:
            print("Error querying overtimes:", e)
            
        # Check overtime_logs
        try:
            cursor.execute("SELECT COUNT(*) FROM overtime_logs")
            ot_log_count = cursor.fetchone()[0]
            print(f"Overtime logs count: {ot_log_count}")
        except Exception as e:
            print("Error querying overtime_logs:", e)
            
        conn.close()

if __name__ == '__main__':
    check_db()
