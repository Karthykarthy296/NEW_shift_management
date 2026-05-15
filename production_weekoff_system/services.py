from models import db, Employee, Weekoff, RotationHistory
import datetime

DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

def get_current_week_start():
    today = datetime.date.today()
    return today - datetime.timedelta(days=today.weekday())

def generate_weekoffs(week_start_date=None):
    if not week_start_date:
        week_start_date = get_current_week_start()
    
    existing = Weekoff.query.filter_by(week_start_date=week_start_date).first()
    if existing:
        return False, "Weekoffs already generated for this week."
        
    employees = Employee.query.all()
    if not employees:
        return False, "No employees found."
        
    prev_week_date = week_start_date - datetime.timedelta(days=7)
    
    # Check rotation history instead of just previous week if needed
    prev_weekoffs = {h.employee_id: h.assigned_day for h in RotationHistory.query.filter_by(week_start_date=prev_week_date).all()}
    
    team_counts = {}
    
    for emp in employees:
        prev_day = prev_weekoffs.get(emp.id)
        if prev_day and prev_day in DAYS_OF_WEEK:
            idx = DAYS_OF_WEEK.index(prev_day)
            # AI Logic: Rotate by 1 day
            new_idx = (idx + 1) % 7
            new_day = DAYS_OF_WEEK[new_idx]
        else:
            # If no previous, assign based on their ID to distribute
            new_day = DAYS_OF_WEEK[emp.id % 7]
            
        # Optional: Add logic to balance team_counts[emp.team][new_day]
        # For simplicity, sticking to strict rotation
        
        # Save to Weekoff
        w = Weekoff(employee_id=emp.id, week_start_date=week_start_date, weekoff_day=new_day)
        db.session.add(w)
        
        # Save to RotationHistory
        h = RotationHistory(employee_id=emp.id, week_start_date=week_start_date, assigned_day=new_day)
        db.session.add(h)
        
    db.session.commit()
    return True, "Weekoffs generated and rotated successfully."
