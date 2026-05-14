"""
Test script to verify dashboard summary calculations
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, Employee, Leave, Schedule, Shift
from datetime import date

def test_dashboard_summary():
    db = SessionLocal()
    
    print("\n" + "="*60)
    print("TESTING DASHBOARD SUMMARY")
    print("="*60)
    
    today = date.today()
    today_str = today.isoformat()
    day_name = today.strftime('%A')
    
    print(f"\nDate: {today_str} ({day_name})")
    
    # 1. Total employees
    total_employees = db.query(Employee).count()
    print(f"\n1️⃣  Total Personnel: {total_employees}")
    
    # 2. People on leave today
    today_leaves = db.query(Leave).filter(Leave.date == today_str).count()
    print(f"2️⃣  Absent Today (On Leave): {today_leaves}")
    
    # 3. People with weekly off today
    today_weekly_off = db.query(Employee).filter(Employee.weekly_off == day_name).count()
    print(f"3️⃣  Resting Today (Weekly Off on {day_name}): {today_weekly_off}")
    
    # 4. Active people today
    active_today = total_employees - today_leaves - today_weekly_off
    print(f"4️⃣  Active Today (Present): {active_today}")
    
    # 5. Shift assignments
    print(f"\n📊 Shift Assignments for {today_str}:")
    schedules = db.query(Schedule).filter(Schedule.date == today_str).all()
    print(f"   Total schedule entries: {len(schedules)}")
    
    from collections import Counter
    shift_counts = Counter()
    for sched in schedules:
        shift = db.query(Shift).filter(Shift.id == sched.shift_id).first()
        if shift:
            shift_counts[shift.name] += 1
    
    for shift_name, count in sorted(shift_counts.items()):
        print(f"   - {shift_name}: {count} employees")
    
    # Verification
    print(f"\n✅ Verification:")
    print(f"   Total: {total_employees}")
    print(f"   Active: {active_today}")
    print(f"   Absent: {today_leaves}")
    print(f"   Resting: {today_weekly_off}")
    print(f"   Sum: {active_today + today_leaves + today_weekly_off} (should equal {total_employees})")
    
    if active_today + today_leaves + today_weekly_off == total_employees:
        print(f"   ✓ Numbers add up correctly!")
    else:
        print(f"   ✗ Numbers don't add up!")
    
    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60 + "\n")
    
    db.close()

if __name__ == "__main__":
    test_dashboard_summary()
