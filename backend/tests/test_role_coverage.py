"""
Test script to verify department-wise main role coverage validation and scheduling intelligence.
"""
import sys
import os
import datetime

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from app.database.database import SessionLocal, Employee, Leave, Schedule, Shift, Department, Overtime
from app.services import ai_scheduler

def setup_coverage_test_data(db):
    print("Setting up test data for role coverage rules...")
    
    # 1. Clean existing test data
    emp_ids = ["COV_TL1", "COV_TL2", "COV_SD1", "COV_QA1", "COV_SEC1", "COV_SEC2", "COV_SEC3"]
    for eid in emp_ids:
        emp = db.query(Employee).filter(Employee.emp_id == eid).first()
        if emp:
            db.query(Schedule).filter(Schedule.employee_id == emp.id).delete()
            db.query(Schedule).filter(Schedule.replaced_employee_id == emp.id).delete()
            db.query(Leave).filter(Leave.employee_id == emp.id).delete()
            db.delete(emp)
    
    # Clean up departments
    db.query(Department).filter(Department.name.in_(["Development", "Security"])).delete()
    db.commit()

    # 2. Departments
    dept_dev = Department(name="Development", min_staff_per_shift=1, max_overtime_weekly=10)
    db.add(dept_dev)
    
    dept_sec = Department(name="Security", min_staff_per_shift=1, max_overtime_weekly=10)
    db.add(dept_sec)
    db.commit()
    db.refresh(dept_dev)
    db.refresh(dept_sec)

    # 3. Shifts
    shift_morning = db.query(Shift).filter(Shift.name == "Morning").first()
    if not shift_morning:
        shift_morning = Shift(name="Morning", start_time="06:00", end_time="14:00", required_employees=1)
        db.add(shift_morning)
        
    shift_evening = db.query(Shift).filter(Shift.name == "Evening").first()
    if not shift_evening:
        shift_evening = Shift(name="Evening", start_time="14:00", end_time="22:00", required_employees=1)
        db.add(shift_evening)
        
    shift_night = db.query(Shift).filter(Shift.name == "Night").first()
    if not shift_night:
        shift_night = Shift(name="Night", start_time="22:00", end_time="06:00", required_employees=1)
        db.add(shift_night)

    week_off_shift = db.query(Shift).filter(Shift.name == "WEEK OFF").first()
    if not week_off_shift:
        week_off_shift = Shift(name="WEEK OFF", start_time="00:00", end_time="00:00", required_employees=0)
        db.add(week_off_shift)
        
    db.commit()
    db.refresh(shift_morning)
    db.refresh(shift_evening)
    db.refresh(shift_night)
    db.refresh(week_off_shift)

    # 4. Create Employees
    # Dev Department (critical: Team Lead >= 1, Senior Developer >= 1, QA Engineer >= 1)
    tl1 = Employee(emp_id="COV_TL1", name="Dev Lead 1", role="Team Lead", department_id=dept_dev.id, max_hours=40, leave_status="Active")
    tl2 = Employee(emp_id="COV_TL2", name="Dev Lead 2", role="Team Lead", department_id=dept_dev.id, max_hours=40, leave_status="Active")
    sd1 = Employee(emp_id="COV_SD1", name="Senior Dev 1", role="Senior Developer", department_id=dept_dev.id, max_hours=40, leave_status="Active")
    qa1 = Employee(emp_id="COV_QA1", name="QA Eng 1", role="QA Engineer", department_id=dept_dev.id, max_hours=40, leave_status="Active")
    
    # Security Department (critical: SOC Engineer >= 1, Security Analyst >= 2)
    sec1 = Employee(emp_id="COV_SEC1", name="SOC Eng 1", role="SOC Engineer", department_id=dept_sec.id, max_hours=40, leave_status="Active")
    sec2 = Employee(emp_id="COV_SEC2", name="Analyst 1", role="Security Analyst", department_id=dept_sec.id, max_hours=40, leave_status="Active")
    sec3 = Employee(emp_id="COV_SEC3", name="Analyst 2", role="Security Analyst", department_id=dept_sec.id, max_hours=40, leave_status="Active")

    db.add_all([tl1, tl2, sd1, qa1, sec1, sec2, sec3])
    db.commit()

    return {
        "dept_dev": dept_dev,
        "dept_sec": dept_sec,
        "tl1": tl1,
        "tl2": tl2,
        "sd1": sd1,
        "qa1": qa1,
        "sec1": sec1,
        "sec2": sec2,
        "sec3": sec3,
        "shifts": [shift_morning, shift_evening, shift_night, week_off_shift]
    }

def test_coverage_rules():
    db = SessionLocal()
    print("\n" + "="*60)
    print("RUNNING DEPARTMENT ROLE COVERAGE TESTS")
    print("="*60)

    try:
        data = setup_coverage_test_data(db)
        
        # Test 1: Staggered Weekly Off Assignment
        print("\nTEST 1: Staggered Weekly Off Assignment Verification")
        # Run auto assignment
        ai_scheduler.auto_assign_weekly_offs(db, force_reassign=True)
        
        # Verify Dev Leads (tl1, tl2) do not share same weekly off day
        db.refresh(data["tl1"])
        db.refresh(data["tl2"])
        print(f"Dev Lead 1 weekly off: {data['tl1'].weekly_off}")
        print(f"Dev Lead 2 weekly off: {data['tl2'].weekly_off}")
        if data["tl1"].weekly_off == data["tl2"].weekly_off:
            print("FAIL: Critical role employees of same department assigned same weekly off!")
        else:
            print("PASS: Critical role weekly off days staggered successfully.")

        # Test 2: Weekly Off Role Coverage Validation
        print("\nTEST 2: Weekly Off Role Coverage Check")
        # Let's force them to have the same weekly off day and check if validation detects it
        data["tl1"].weekly_off = "Sunday"
        data["tl2"].weekly_off = "Sunday"
        db.commit()
        
        all_emps = [data["tl1"], data["tl2"], data["sd1"], data["qa1"]]
        is_valid, err_msg = ai_scheduler.check_weekly_off_role_coverage(db, all_emps)
        if not is_valid:
            print(f"PASS: Correctly detected role coverage failure: {err_msg}")
        else:
            print("FAIL: Validation did not catch overlapping weekly offs for critical roles!")

        # Restore staggered offs
        data["tl1"].weekly_off = "Monday"
        data["tl2"].weekly_off = "Tuesday"
        db.commit()

        # Test 3: Daily Role Coverage Check
        print("\nTEST 3: Daily Role Coverage Check")
        target_date = "2026-06-01"
        shifts = {s.name: s.id for s in data["shifts"]}
        
        # Scenario A: Valid schedules containing min critical roles
        proposed_valid = [
            {"employee_id": data["tl1"].id, "shift_id": shifts["Morning"]},
            {"employee_id": data["tl2"].id, "shift_id": shifts["WEEK OFF"]}, # Staggered off
            {"employee_id": data["sd1"].id, "shift_id": shifts["Evening"]},
            {"employee_id": data["qa1"].id, "shift_id": shifts["Night"]},
        ]
        is_valid, err_msg = ai_scheduler.check_department_role_coverage(db, target_date, proposed_valid)
        if is_valid:
            print("PASS: Valid schedule layout accepted.")
        else:
            print(f"FAIL: Valid schedule rejected: {err_msg}")

        # Scenario B: Invalid schedule layout (No Senior Developer working today)
        proposed_invalid = [
            {"employee_id": data["tl1"].id, "shift_id": shifts["Morning"]},
            {"employee_id": data["tl2"].id, "shift_id": shifts["WEEK OFF"]},
            {"employee_id": data["sd1"].id, "shift_id": shifts["WEEK OFF"]}, # Both Senior Dev off
            {"employee_id": data["qa1"].id, "shift_id": shifts["Night"]},
        ]
        is_valid, err = ai_scheduler.check_department_role_coverage(db, target_date, proposed_invalid)
        if not is_valid:
            print(f"PASS: Correctly blocked schedule with missing critical role: {err}")
        else:
            print("FAIL: Allowed schedule with missing Senior Developer!")

        # Test 4: Shift-specific Staggering Verification
        print("\nTEST 4: Active Shift Skill Staggering in generate_ai_schedule")
        # Run scheduling generation
        ai_scheduler.generate_ai_schedule(db, target_date, force_refresh=True)
        
        # Verify Dev Leads (tl1, tl2) are distributed to different active shifts
        # (Since Monday is tl1's off day, only tl2 is working. Let's make sure tl2 works, and on Wednesday both work on different shifts)
        wednesday = "2026-06-03" # Neither tl1 nor tl2 are off on Wednesday
        data["tl1"].weekly_off = "Monday"
        data["tl2"].weekly_off = "Tuesday"
        db.commit()
        
        ai_scheduler.generate_ai_schedule(db, wednesday, force_refresh=True)
        
        tl1_sched = db.query(Schedule).filter(Schedule.employee_id == data["tl1"].id, Schedule.date == wednesday).first()
        tl2_sched = db.query(Schedule).filter(Schedule.employee_id == data["tl2"].id, Schedule.date == wednesday).first()
        
        if tl1_sched and tl2_sched:
            print(f"Dev Lead 1 Shift: {tl1_sched.shift.name}")
            print(f"Dev Lead 2 Shift: {tl2_sched.shift.name}")
            if tl1_sched.shift_id == tl2_sched.shift_id and tl1_sched.shift.name != "WEEK OFF":
                print("FAIL: Both critical employees assigned to the same active shift!")
            else:
                print("PASS: Critical roles staggered across shifts successfully.")
        else:
            print("FAIL: Schedules not found for Dev Leads on Wednesday.")

        # Test 5: Fallback role replacement selection
        print("\nTEST 5: Fallback role replacement selection")
        # If absent employee is Dev Lead 1, and no other Dev Lead is available, can it fall back to other Developers in the same department?
        # Let's put tl2 on leave today, so no other Team Lead is available.
        db.add(Leave(employee_id=data["tl2"].id, date=target_date))
        # Clear schedule for sd1 on target_date to make them available
        db.query(Schedule).filter(Schedule.employee_id == data["sd1"].id, Schedule.date == target_date).delete()
        db.commit()
        
        best_rep = ai_scheduler.find_best_replacement(db, data["tl1"].id, target_date, shifts["Morning"])
        if best_rep:
            print(f"Selected fallback candidate: {best_rep.name} (Role: {best_rep.role})")
            if best_rep.department_id == data["tl1"].department_id:
                print("PASS: Successfully fell back to same-department candidate when exact role match was unavailable.")
            else:
                print("FAIL: Fallback candidate is not in the same department!")
        else:
            print("FAIL: No fallback candidate found!")

    finally:
        # Clean up test data
        emp_ids = ["COV_TL1", "COV_TL2", "COV_SD1", "COV_QA1", "COV_SEC1", "COV_SEC2", "COV_SEC3"]
        for eid in emp_ids:
            emp = db.query(Employee).filter(Employee.emp_id == eid).first()
            if emp:
                db.query(Schedule).filter(Schedule.employee_id == emp.id).delete()
                db.query(Leave).filter(Leave.employee_id == emp.id).delete()
                db.delete(emp)
        db.query(Department).filter(Department.name.in_(["Development", "Security"])).delete()
        db.commit()
        db.close()

if __name__ == "__main__":
    test_coverage_rules()
