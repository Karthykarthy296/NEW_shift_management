import os
import sys
import datetime

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from database import SessionLocal, Employee, Department, Base, engine
import ai_scheduler

# Create tables if not exist
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    print("Clearing existing employees...")
    db.query(Employee).delete()
    db.query(Department).delete()
    db.commit()

    print("Creating departments...")
    dept_it = Department(name="IT", min_staff_per_shift=5)
    dept_hr = Department(name="HR", min_staff_per_shift=2)
    db.add_all([dept_it, dept_hr])
    db.commit()

    print("Generating 10,000 employees...")
    emps = []
    for i in range(10000):
        dept_id = dept_it.id if i % 2 == 0 else dept_hr.id
        emps.append(Employee(
            emp_id=f"TEST{i}", 
            name=f"Test {i}", 
            department_id=dept_id,
            weekly_off=None
        ))
    
    db.bulk_save_objects(emps)
    db.commit()
    print("Employees inserted.")

    print("Running auto_assign_weekly_offs...")
    res = ai_scheduler.auto_assign_weekly_offs(db, force_reassign=True)
    print("Result:", res)

    print("Verifying database distribution...")
    dist = ai_scheduler.get_weekly_off_distribution(db)
    print("Final Distribution:", dist)

finally:
    db.close()
