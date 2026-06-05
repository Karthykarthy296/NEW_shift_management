"""
Test script to verify AI Replacement Service business rules and priority logic.
"""
import sys
import os
import datetime

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from app.database.database import SessionLocal, Employee, Leave, Schedule, Shift, Department, Overtime, WeeklyOffHistory
from app.services import ai_scheduler

def setup_test_data(db):
    print("Setting up test data for replacement rules...")
    
    # 1. Clean existing test data
    emp_ids = ["REP_ABSENT", "REP_DEV_OFF", "REP_DEV_BUSY", "REP_DEV_MAX", "REP_SEC_OFF", "REP_DEV_DEPT"]
    for eid in emp_ids:
        emp = db.query(Employee).filter(Employee.emp_id == eid).first()
        if emp:
            db.query(WeeklyOffHistory).filter(WeeklyOffHistory.employee_id == emp.id).delete()
            db.query(Schedule).filter(Schedule.employee_id == emp.id).delete()
            db.query(Schedule).filter(Schedule.replaced_employee_id == emp.id).delete()
            db.query(Leave).filter(Leave.employee_id == emp.id).delete()
            db.query(Overtime).filter(Overtime.employee_id == emp.id).delete()
            db.delete(emp)
    db.commit()

    # 2. Departments
    dept_dev = db.query(Department).filter(Department.name == "R&D").first()
    if not dept_dev:
        dept_dev = Department(name="R&D", min_staff_per_shift=1, max_overtime_weekly=10)
        db.add(dept_dev)
        db.commit()
        db.refresh(dept_dev)

    dept_sec = db.query(Department).filter(Department.name == "Security Dept").first()
    if not dept_sec:
        dept_sec = Department(name="Security Dept", min_staff_per_shift=1, max_overtime_weekly=10)
        db.add(dept_sec)
        db.commit()
        db.refresh(dept_sec)

    # 3. Shifts
    shift_morning = db.query(Shift).filter(Shift.name == "Morning").first()
    if not shift_morning:
        shift_morning = Shift(name="Morning", start_time="06:00", end_time="14:00", required_employees=1)
        db.add(shift_morning)
        db.commit()
        db.refresh(shift_morning)

    # 4. Employees
    # Absent Developer
    absent_dev = Employee(
        emp_id="REP_ABSENT",
        name="Absent Developer",
        role="Developer",
        department_id=dept_dev.id,
        weekly_off="Sunday",
        max_hours=40,
        leave_status="Active"
    )
    db.add(absent_dev)
    
    # Available Developer on Weekly Off
    dev_off = Employee(
        emp_id="REP_DEV_OFF",
        name="Off Developer",
        role="Developer",
        department_id=dept_dev.id,
        weekly_off="Monday",  # Weekly off matches test day Monday
        max_hours=40,
        leave_status="Active"
    )
    db.add(dev_off)

    # Busy Developer (Already working today)
    dev_busy = Employee(
        emp_id="REP_DEV_BUSY",
        name="Busy Developer",
        role="Developer",
        department_id=dept_dev.id,
        weekly_off="Sunday",
        max_hours=40,
        leave_status="Active"
    )
    db.add(dev_busy)

    # Developer who would exceed Max Weekly Hours (40 hrs max, currently has 36 hours assigned)
    dev_max = Employee(
        emp_id="REP_DEV_MAX",
        name="Max-Hours Developer",
        role="Developer",
        department_id=dept_dev.id,
        weekly_off="Sunday",
        max_hours=40,
        leave_status="Active"
    )
    db.add(dev_max)

    # Security Guard on Weekly Off (Different Role)
    sec_off = Employee(
        emp_id="REP_SEC_OFF",
        name="Off Security Guard",
        role="Security",
        department_id=dept_sec.id,
        weekly_off="Monday",
        max_hours=40,
        leave_status="Active"
    )
    db.add(sec_off)

    # Developer in Different Department (Security Dept but same role "Developer" for fallback testing)
    dev_dept = Employee(
        emp_id="REP_DEV_DEPT",
        name="Other Dept Developer",
        role="Developer",
        department_id=dept_sec.id,
        weekly_off="Monday",
        max_hours=40,
        leave_status="Active"
    )
    db.add(dev_dept)

    db.commit()
    db.refresh(absent_dev)
    db.refresh(dev_off)
    db.refresh(dev_busy)
    db.refresh(dev_max)
    db.refresh(sec_off)
    db.refresh(dev_dept)

    return {
        "absent_dev": absent_dev,
        "dev_off": dev_off,
        "dev_busy": dev_busy,
        "dev_max": dev_max,
        "sec_off": sec_off,
        "dev_dept": dev_dept,
        "shift_morning": shift_morning
    }

def test_replacement_rules():
    db = SessionLocal()
    print("\n" + "="*60)
    print("RUNNING AI REPLACEMENT ENGINE TESTS")
    print("="*60)

    try:
        data = setup_test_data(db)
        absent_dev = data["absent_dev"]
        dev_off = data["dev_off"]
        dev_busy = data["dev_busy"]
        dev_max = data["dev_max"]
        sec_off = data["sec_off"]
        dev_dept = data["dev_dept"]
        shift = data["shift_morning"]

        test_monday = "2026-06-01"  # Monday

        # Create schedule for absent developer today
        sched_absent = Schedule(
            employee_id=absent_dev.id,
            date=test_monday,
            shift_id=shift.id
        )
        db.add(sched_absent)

        # Create schedule for Busy Developer (already working Morning shift today)
        sched_busy = Schedule(
            employee_id=dev_busy.id,
            date=test_monday,
            shift_id=shift.id
        )
        db.add(sched_busy)

        # Create schedule for Max Developer (5 shifts * 8 hrs = 40 hours) to test max hours check
        # We assign them 5 schedules in the target week
        for offset in range(1, 6):
            t_date = (datetime.date.fromisoformat(test_monday) + datetime.timedelta(days=offset)).isoformat()
            db.add(Schedule(employee_id=dev_max.id, date=t_date, shift_id=shift.id))

        db.commit()

        # TEST 1: Strict Role Validation
        # The Security Guard (sec_off) has different role 'Security'. Developer is 'Developer'.
        # The replacement must be a Developer.
        print("\nTEST 1: Strict Role Validation (Security Guard should be rejected)")
        best_rep = ai_scheduler.find_best_replacement(db, absent_dev.id, test_monday, shift.id)
        if best_rep and best_rep.role != "Developer":
            print(f"FAIL: Assigned non-developer role: {best_rep.role}")
        else:
            print("PASS: Non-developer role was correctly bypassed.")

        # TEST 2: Double Shift Validation
        # Busy Developer (dev_busy) is already working today.
        print("\nTEST 2: Double Shift Validation (Busy Developer should be rejected)")
        if best_rep and best_rep.id == dev_busy.id:
            print("FAIL: Assigned Busy Developer to double shift today!")
        else:
            print("PASS: Busy Developer working today was correctly bypassed.")

        # TEST 3: Max Hours Validation
        # Max-Hours Developer (dev_max) is already assigned 40 hours this week.
        print("\nTEST 3: Max Hours Validation (Max-Hours Developer should be rejected)")
        if best_rep and best_rep.id == dev_max.id:
            print("FAIL: Assigned Max-Hours Developer exceeding weekly limits!")
        else:
            print("PASS: Developer exceeding weekly hours limit was correctly bypassed.")

        # TEST 4: Priority Ordering - Off-day status & Department Match
        # We have dev_off (Developer, off-day Monday, same department 'R&D')
        # We have dev_dept (Developer, off-day Monday, different department 'Security')
        # dev_off should be preferred over dev_dept due to Department Match.
        print("\nTEST 4: Priority Ordering - Same department backup vs different department")
        print(f"Candidate chosen: {best_rep.name if best_rep else 'None'}")
        if best_rep and best_rep.id == dev_off.id:
            print("PASS: Selected same department developer on weekly off first.")
        else:
            print("FAIL: Same-department off-day developer was not prioritized!")

        # TEST 5: Trigger Reassign Shift Integration
        print("\nTEST 5: Triggering Shift Reassignment")
        ai_scheduler.reassign_shift(db, absent_dev.id, test_monday)
        
        # Verify database update
        db.refresh(sched_absent)
        if sched_absent.employee_id == dev_off.id and sched_absent.is_override and sched_absent.replaced_employee_id == absent_dev.id:
            print("PASS: Schedule successfully reassigned in database with override log.")
        else:
            print("FAIL: Schedule override was not persisted correctly in database.")

    finally:
        db.close()

if __name__ == "__main__":
    test_replacement_rules()
