import heapq
import datetime
import math
from collections import defaultdict
from models import db, Employee, Weekoff, Leave

DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
CRITICAL_DEPARTMENTS = ['Security', 'Support', 'Operations']

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
        
    total_emps = len(employees)
    # 2. Distributed equally across 7 days
    max_off_per_day = math.ceil(total_emps / 7.0)
    
    # 8. Department-wise balance
    dept_emps = defaultdict(list)
    for emp in employees:
        dept_emps[emp.team].append(emp)
        
    dept_max_off = {}
    for dept, emps in dept_emps.items():
        dept_max_off[dept] = math.ceil(len(emps) / 7.0)

    # 3. Rotation every week - Get previous week weekoffs to rotate
    prev_week_date = week_start_date - datetime.timedelta(days=7)
    prev_weekoffs = {w.employee_id: w.weekoff_day for w in Weekoff.query.filter_by(week_start_date=prev_week_date).all()}
    
    # 4. Employees on leave should not receive additional weekly off
    week_end_date = week_start_date + datetime.timedelta(days=6)
    leaves = Leave.query.filter(Leave.start_date <= week_end_date, Leave.end_date >= week_start_date).all()
    employee_leave_days = defaultdict(set)
    for leave in leaves:
        curr_date = max(leave.start_date, week_start_date)
        end = min(leave.end_date, week_end_date)
        while curr_date <= end:
            employee_leave_days[leave.employee_id].add(curr_date.weekday())
            curr_date += datetime.timedelta(days=1)

    # 9. Overtime gets priority
    # 10. Night shifts continuously balanced
    sorted_emps = sorted(
        employees,
        key=lambda x: (-x.overtime_hours, 0 if x.shift.lower() == 'night' else 1, x.id)
    )

    day_off_counts = {day: 0 for day in DAYS_OF_WEEK}
    dept_day_off_counts = {dept: {day: 0 for day in DAYS_OF_WEEK} for dept in dept_emps}

    for emp in sorted_emps:
        valid_days = []
        for i, day in enumerate(DAYS_OF_WEEK):
            # 11. Max limit per day not exceed allowed count
            if day_off_counts[day] >= max_off_per_day:
                continue
                
            # Department balance
            if dept_day_off_counts[emp.team][day] >= dept_max_off[emp.team]:
                continue
                
            score = 0
            
            # Prefer assigning weekoff on a leave day so they don't get an extra one
            if i in employee_leave_days[emp.id]:
                score -= 5000
                
            # 6. Avoid assigning same weekly off repeatedly
            prev_day = prev_weekoffs.get(emp.id)
            if prev_day == day:
                score += 1000
            elif prev_day in DAYS_OF_WEEK:
                prev_idx = DAYS_OF_WEEK.index(prev_day)
                if i == (prev_idx + 1) % 7:
                    score -= 500 # Reward rotation to next day
                    
            heapq.heappush(valid_days, (score, day))
            
        # Fallback 1: Relax department constraint
        if not valid_days:
            for i, day in enumerate(DAYS_OF_WEEK):
                if day_off_counts[day] >= max_off_per_day:
                    continue
                score = 0
                if i in employee_leave_days[emp.id]: score -= 5000
                prev_day = prev_weekoffs.get(emp.id)
                if prev_day == day: score += 1000
                elif prev_day in DAYS_OF_WEEK and i == (DAYS_OF_WEEK.index(prev_day) + 1) % 7: score -= 500
                heapq.heappush(valid_days, (score, day))
                
        # Fallback 2: Relax overall constraint
        if not valid_days:
            for i, day in enumerate(DAYS_OF_WEEK):
                heapq.heappush(valid_days, (0, day))
                
        best_day = heapq.heappop(valid_days)[1]
        
        w = Weekoff(employee_id=emp.id, week_start_date=week_start_date, weekoff_day=best_day)
        db.session.add(w)
        day_off_counts[best_day] += 1
        dept_day_off_counts[emp.team][best_day] += 1
        
    db.session.commit()
    return True, "AI Weekly Off rules applied. Generated successfully."
