from models import db, Employee, Weekoff
import datetime

DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

def get_current_week_start():
    today = datetime.date.today()
    return today - datetime.timedelta(days=today.weekday())

def generate_ai_weekoffs(week_start_date=None):
    if not week_start_date:
        week_start_date = get_current_week_start()
    
    # Check if weekoffs already exist for this week
    existing = Weekoff.query.filter_by(week_start_date=week_start_date).first()
    if existing:
        return False, "Weekoffs already generated for this week."
        
    employees = Employee.query.all()
    if not employees:
        return False, "No employees found."
        
    # Get previous week weekoffs to rotate
    prev_week_date = week_start_date - datetime.timedelta(days=7)
    prev_weekoffs = {w.employee_id: w.weekoff_day for w in Weekoff.query.filter_by(week_start_date=prev_week_date).all()}
    
    # Track team availability to balance workforce (simple logic here)
    # We rotate based on previous week.
    for emp in employees:
        prev_day = prev_weekoffs.get(emp.id)
        if prev_day and prev_day in DAYS_OF_WEEK:
            idx = DAYS_OF_WEEK.index(prev_day)
            new_idx = (idx + 1) % 7 # Rotate by 1 day
            new_day = DAYS_OF_WEEK[new_idx]
        else:
            # If no previous, assign based on their ID to distribute
            new_day = DAYS_OF_WEEK[emp.id % 7]
            
        w = Weekoff(employee_id=emp.id, week_start_date=week_start_date, weekoff_day=new_day)
        db.session.add(w)
        
    db.session.commit()
    return True, "Weekoffs generated successfully."
