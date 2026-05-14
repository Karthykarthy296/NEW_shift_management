"""
Update script to change leave_status from 'Active' to 'Present'
"""
import sqlite3
import os

DB_PATH = "shift_db_new.db"

def update_leave_status():
    print("\n" + "="*60)
    print("UPDATING LEAVE STATUS: Active → Present")
    print("="*60)
    
    if not os.path.exists(DB_PATH):
        print(f"✗ Database not found: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Count current statuses
        cursor.execute("SELECT leave_status, COUNT(*) FROM employees GROUP BY leave_status")
        before = cursor.fetchall()
        print(f"\n📊 Before update:")
        for status, count in before:
            print(f"   {status}: {count} employees")
        
        # Update Active to Present
        print(f"\n🔄 Updating 'Active' to 'Present'...")
        cursor.execute("UPDATE employees SET leave_status = 'Present' WHERE leave_status = 'Active' OR leave_status IS NULL")
        updated = cursor.rowcount
        
        conn.commit()
        
        # Count after update
        cursor.execute("SELECT leave_status, COUNT(*) FROM employees GROUP BY leave_status")
        after = cursor.fetchall()
        print(f"\n✅ After update:")
        for status, count in after:
            print(f"   {status}: {count} employees")
        
        print(f"\n✓ Updated {updated} employees")
        
        # Show sample data
        cursor.execute("SELECT emp_id, name, leave_status FROM employees LIMIT 5")
        rows = cursor.fetchall()
        print(f"\n📋 Sample data:")
        for row in rows:
            print(f"   {row[0]} - {row[1]} | Leave Status: {row[2]}")
        
        print("\n" + "="*60)
        print("UPDATE COMPLETE")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n✗ Update failed: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    update_leave_status()
