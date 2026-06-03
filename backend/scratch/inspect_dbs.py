import sqlite3
import os

db_root = "c:/Users/prabh/OneDrive/Desktop/NEW_shift_management/shift_db_new.db"
db_backend = "c:/Users/prabh/OneDrive/Desktop/NEW_shift_management/backend/shift_db_new.db"

def inspect_db(db_path):
    print(f"\n=== Inspecting: {db_path} ===")
    if not os.path.exists(db_path):
        print("File does not exist!")
        return
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        print("Tables and row counts:")
        for t in sorted(tables):
            try:
                cursor.execute(f"SELECT COUNT(*) FROM `{t}`")
                count = cursor.fetchone()[0]
                print(f"  - {t}: {count} rows")
            except Exception as e:
                print(f"  - {t}: Error counting ({e})")
    except Exception as e:
        print("Error reading database:", e)
    finally:
        conn.close()

if __name__ == '__main__':
    inspect_db(db_root)
    inspect_db(db_backend)
