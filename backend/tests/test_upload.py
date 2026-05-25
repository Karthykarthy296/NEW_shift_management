"""
Test script to verify Excel upload functionality
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database.database import SessionLocal, Shift, Employee, Department
from app.services.excel_upload_manager import ExcelUploadManager

def test_upload():
    db = SessionLocal()
    
    print("\n" + "="*60)
    print("TESTING EXCEL UPLOAD MANAGER")
    print("="*60)
    
    # Check shifts
    shifts = db.query(Shift).all()
    print(f"\n✓ Found {len(shifts)} shifts in database:")
    for shift in shifts:
        print(f"  - {shift.name}: {shift.start_time} - {shift.end_time}")
    
    if not shifts:
        print("\n⚠ Creating default shifts...")
        default_shifts = [
            Shift(name="Morning", start_time="06:00", end_time="12:00", required_employees=3),
            Shift(name="Afternoon", start_time="12:00", end_time="18:00", required_employees=3),
            Shift(name="Evening", start_time="18:00", end_time="00:00", required_employees=2),
            Shift(name="Night", start_time="00:00", end_time="06:00", required_employees=2)
        ]
        for shift in default_shifts:
            db.add(shift)
        db.commit()
        print("✓ Default shifts created")
    
    # Check employees
    employees = db.query(Employee).all()
    print(f"\n✓ Found {len(employees)} employees in database")
    
    # Check departments
    departments = db.query(Department).all()
    print(f"✓ Found {len(departments)} departments in database")
    
    # Test Excel file path
    test_file = "uploads/1000_employees_updated.xlsx"
    if os.path.exists(test_file):
        print(f"\n📊 Testing with file: {test_file}")
        
        manager = ExcelUploadManager(db)
        success, message, data = manager.parse_excel_file(test_file)
        
        if success:
            print(f"✓ Parse successful: {message}")
            print(f"  Sample data (first 3 rows):")
            for i, emp in enumerate(data[:3]):
                print(f"    {i+1}. {emp['emp_id']} - {emp['name']} ({emp['department']})")
        else:
            print(f"✗ Parse failed: {message}")
    else:
        print(f"\n⚠ Test file not found: {test_file}")
    
    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60 + "\n")
    
    db.close()

if __name__ == "__main__":
    test_upload()
