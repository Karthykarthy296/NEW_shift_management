"""
Test script to verify auto-assign weekly offs functionality
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database.database import SessionLocal, Employee, Shift, Schedule
from app.services import ai_scheduler
from datetime import date

def test_auto_assign():
    db = SessionLocal()
    
    print("\n" + "="*60)
    print("TESTING AUTO-ASSIGN WEEKLY OFFS")
    print("="*60)
    
    # Check employees
    employees = db.query(Employee).all()
    print(f"\n✓ Found {len(employees)} employees in database")
    
    # Check shifts
    shifts = db.query(Shift).all()
    print(f"✓ Found {len(shifts)} shifts in database")
    
    if not shifts:
        print("\n⚠ No shifts found. This will cause errors!")
        db.close()
        return
    
    # Test auto-assign
    try:
        print("\n🤖 Running auto_assign_weekly_offs...")
        ai_scheduler.auto_assign_weekly_offs(db)
        print("✓ Auto-assign completed")
        
        # Check distribution
        from collections import Counter
        weekly_offs = [e.weekly_off for e in db.query(Employee).all()]
        distribution = Counter(weekly_offs)
        print("\n📊 Weekly off distribution:")
        for day, count in sorted(distribution.items()):
            print(f"  {day}: {count} employees")
        
    except Exception as e:
        print(f"\n✗ Error in auto-assign: {str(e)}")
        import traceback
        traceback.print_exc()
        db.close()
        return
    
    # Test schedule generation
    try:
        print("\n🤖 Running generate_ai_schedule...")
        today = date.today().isoformat()
        ai_scheduler.generate_ai_schedule(db, today, force_refresh=True)
        print("✓ Schedule generation completed")
        
        # Check schedule
        schedules = db.query(Schedule).filter(Schedule.date == today).all()
        print(f"\n📅 Generated {len(schedules)} schedule assignments for {today}")
        
    except Exception as e:
        print(f"\n✗ Error in schedule generation: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60 + "\n")
    
    db.close()

if __name__ == "__main__":
    test_auto_assign()
