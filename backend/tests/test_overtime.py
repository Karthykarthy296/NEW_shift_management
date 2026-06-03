"""
Test script to verify Overtime Service business rules and database integration.
"""
import sys
import os
from datetime import datetime, timedelta

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from app.database.database import SessionLocal, Employee, Leave, Schedule, Shift, Overtime, Department
from app.services.overtime_service import OvertimeService
from fastapi import HTTPException

def setup_test_data(db):
    print("Setting up test data...")
    # Find or create a test department
    dept = db.query(Department).filter(Department.name == "Test Department").first()
    if not dept:
        dept = Department(name="Test Department", max_overtime_weekly=10)
        db.add(dept)
        db.commit()
        db.refresh(dept)
    else:
        # Reset max overtime weekly just in case
        dept.max_overtime_weekly = 10
        db.commit()

    # Find or create a test shift
    shift = db.query(Shift).filter(Shift.name == "Morning").first()
    if not shift:
        shift = Shift(name="Morning")
        db.add(shift)
        db.commit()
        db.refresh(shift)

    # Find or create a test employee
    emp = db.query(Employee).filter(Employee.emp_id == "TEST001").first()
    if emp:
        # Clean up any existing leaves, schedules, overtime for this employee
        db.query(Overtime).filter(Overtime.employee_id == emp.id).delete()
        db.query(Leave).filter(Leave.employee_id == emp.id).delete()
        db.query(Schedule).filter(Schedule.employee_id == emp.id).delete()
        db.delete(emp)
        db.commit()

    emp = Employee(
        emp_id="TEST001",
        name="Test Employee",
        department_id=dept.id,
        weekly_off="Sunday",
        leave_status="Active"
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)

    return emp, dept, shift

def test_overtime_rules():
    db = SessionLocal()
    print("\n" + "="*60)
    print("RUNNING OVERTIME SYSTEM TESTS")
    print("="*60)

    try:
        emp, dept, shift = setup_test_data(db)
        print(f"Created test employee: {emp.name} (ID: {emp.id}) with Weekly Off: {emp.weekly_off}")

        # Choose a Monday for testing (e.g. 2026-06-01)
        test_monday = "2026-06-01"
        test_sunday = "2026-06-07"

        # Create schedule record for test_monday so employee is "scheduled"
        sched = Schedule(
            employee_id=emp.id,
            date=test_monday,
            shift_id=shift.id
        )
        db.add(sched)
        db.commit()
        print(f"1. Schedule created for employee on {test_monday}.")

        # Test Rule 1: Cannot assign OT on Weekly Off (Sunday)
        print("\nTest Rule: Assigning OT on Weekly Off (Sunday)")
        try:
            OvertimeService.add_overtime(
                db=db,
                employee_id=emp.id,
                overtime_hours=2.0,
                overtime_date=test_sunday,
                reason="Weekly off check"
            )
            print("FAIL: Overtime was allowed on weekly off day!")
        except HTTPException as he:
            print(f"PASS: Blocked as expected: {he.detail}")

        # Test Rule 2: Cannot assign OT on Leave day
        print("\nTest Rule: Assigning OT on a Leave Day")
        # Apply leave for employee on test_monday
        leave = Leave(
            employee_id=emp.id,
            date=test_monday
        )
        db.add(leave)
        db.commit()


        try:
            OvertimeService.add_overtime(
                db=db,
                employee_id=emp.id,
                overtime_hours=2.0,
                overtime_date=test_monday,
                reason="Leave day check"
            )
            print("FAIL: Overtime was allowed on a leave day!")
        except HTTPException as he:
            print(f"PASS: Blocked as expected: {he.detail}")

        # Clean up leave
        db.delete(leave)
        db.commit()

        # Test Rule 3: Cannot assign OT if not scheduled/no attendance record
        test_tuesday = "2026-06-02"
        print("\nTest Rule: Assigning OT with no scheduled shift")
        try:
            OvertimeService.add_overtime(
                db=db,
                employee_id=emp.id,
                overtime_hours=2.0,
                overtime_date=test_tuesday,
                reason="No schedule check"
            )
            print("FAIL: Overtime was allowed without a scheduled shift!")
        except HTTPException as he:
            print(f"PASS: Blocked as expected: {he.detail}")

        # Create schedule for Tuesday
        sched2 = Schedule(
            employee_id=emp.id,
            date=test_tuesday,
            shift_id=shift.id
        )
        db.add(sched2)
        db.commit()

        # Test Rule 4: Successful OT addition
        print("\nTest Rule: Successful Overtime addition")
        try:
            ot = OvertimeService.add_overtime(
                db=db,
                employee_id=emp.id,
                overtime_hours=4.0,
                overtime_date=test_monday,
                reason="System testing",
                status="approved"
            )
            print(f"PASS: Overtime added: {ot.overtime_hours} hrs for {ot.employee_name} on {ot.overtime_date}")
        except Exception as e:
            print(f"FAIL: Could not add overtime: {str(e)}")

        # Test Rule 5: Duplicate prevention
        print("\nTest Rule: Duplicate Overtime prevention")
        try:
            OvertimeService.add_overtime(
                db=db,
                employee_id=emp.id,
                overtime_hours=2.0,
                overtime_date=test_monday,
                reason="Duplicate check"
            )
            print("FAIL: Duplicate overtime entry was allowed!")
        except HTTPException as he:
            print(f"PASS: Blocked as expected: {he.detail}")

        # Test Rule 6: Weekly limit checking
        print("\nTest Rule: Weekly OT limit check (Limit: 10 hrs, Current: 4 hrs)")
        # Let's add schedule for Wednesday, Thursday, Friday
        for day in ["2026-06-03", "2026-06-04", "2026-06-05"]:
            sc = Schedule(employee_id=emp.id, date=day, shift_id=shift.id)
            db.add(sc)
        db.commit()

        # Add 4 hours for Wednesday
        OvertimeService.add_overtime(
            db=db,
            employee_id=emp.id,
            overtime_hours=4.0,
            overtime_date="2026-06-03",
            reason="Additional hours",
            status="approved"
        )
        print("Added 4 more hours. Total weekly hours is now 8.0.")

        # Attempting to add 3 more hours on Thursday (will exceed 10 hours limit)
        try:
            OvertimeService.add_overtime(
                db=db,
                employee_id=emp.id,
                overtime_hours=3.0,
                overtime_date="2026-06-04",
                reason="Over limit check"
            )
            print("FAIL: Weekly limit check failed to trigger!")
        except HTTPException as he:
            print(f"PASS: Blocked weekly limit exceedance as expected: {he.detail}")

        # Clean up test data
        print("\nCleaning up test data...")
        db.query(Overtime).filter(Overtime.employee_id == emp.id).delete()
        db.query(Schedule).filter(Schedule.employee_id == emp.id).delete()
        db.delete(emp)
        db.commit()
        print("Cleanup successful.")

    except Exception as e:
        print(f"ERROR: Test script failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

    print("\n" + "="*60)
    print("TEST COMPLETION")
    print("="*60 + "\n")

if __name__ == "__main__":
    test_overtime_rules()

