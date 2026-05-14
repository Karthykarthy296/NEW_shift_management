import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import Employee, Shift, Schedule, Leave, Department, OvertimeLog
from datetime import date, timedelta
import random
from functools import lru_cache
import time

# Simple cache for schedule results to avoid recomputation
_schedule_cache = {}
_cache_expiry = 300 # 5 minutes

def clear_schedule_cache():
    global _schedule_cache
    _schedule_cache = {}
    print("[AI] Schedule cache cleared.")

def auto_assign_weekly_offs(db: Session):
    """
    AI Logic: Distributes weekly offs evenly across all employees (1000+)
    Ensures ~143 employees are off each day of the week.
    ROTATION: Every week, the off-day shifts by 1 day to ensure fairness.
    """
    employees = db.query(Employee).order_by(Employee.id).all()
    if not employees:
        return
    
    # Get current week number for rotation
    import datetime
    week_num = datetime.date.today().isocalendar()[1]
    
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    for i, emp in enumerate(employees):
        # Rotate by adding week_num as an offset
        emp.weekly_off = days[(i + week_num) % 7]
    
    db.commit()
    print(f"[AI] Auto-assigned and ROTATED weekly offs for {len(employees)} employees (Week {week_num}).")

# ─── Column name aliases (extremely permissive) ─────────────────────────────
COL_EMP_ID     = ['employee id', 'emp id', 'id', 'empid', 'staff id', 'eid', 'code', 'employee #', 'employee_id']
COL_NAME       = ['name', 'employee name', 'full name', 'emp name', 'staff name', 'person', 'fullname']
COL_SKILLS     = ['skills', 'qualifications', 'skillset', 'ability', 'roles', 'skill', 'dept']
COL_PREF_SHIFT = ['preferred shift', 'preference', 'shift preference', 'preferred', 'preferred_shift', 'choice']
COL_MAX_HOURS  = ['max hours', 'hours limit', 'hours', 'max hrs', 'max_hours', 'limit']
COL_SHIFT_NAME = ['shift name', 'shift', 'shift_name', 'typename', 'slot']
COL_START_TIME = ['start time', 'start', 'start_time', 'from', 'begins', 'opening']
COL_END_TIME   = ['end time', 'end', 'end_time', 'to', 'ends', 'closing']
COL_WEEKLY_OFF = ['weekly off', 'week off', 'off day', 'off', 'weekly_off', 'day off']


def _get(row: dict, keys: list):
    """Case-insensitive column lookup."""
    for k in row:
        if k.lower().strip() in keys:
            return row[k]
    return None


def parse_combined_excel(file_path: str, db: Session) -> str:
    """
    Parses Excel with employee columns + optional shift timing columns.
    - Upserts employees by emp_id
    - If Shift Name + Start Time + End Time columns exist, updates OR creates
      that shift's timing in DB.
    - Returns a summary string.
    """
    df = pd.read_excel(file_path, dtype=str)
    df = df.where(pd.notna(df), None)

    inserted = 0
    updated  = 0
    skipped  = 0
    processed_shift_names = set()

    for idx, row in df.iterrows():
        try:
            row_dict = row.to_dict()

            # ── Employee data (LOOSE VALIDATION) ──────────────────────────────
            emp_id = _get(row_dict, COL_EMP_ID)
            name   = _get(row_dict, COL_NAME)

            # Accept if we have either ID or Name
            if emp_id or name:
                emp_id = str(emp_id if emp_id else f"EMP-{idx+1}").strip()
                name   = str(name if name else f"Employee {emp_id}").strip()

                raw_skills = _get(row_dict, COL_SKILLS)
                pref_shift = _get(row_dict, COL_PREF_SHIFT)
                max_hrs    = _get(row_dict, COL_MAX_HOURS)
                weekly_off = _get(row_dict, COL_WEEKLY_OFF)

                skills     = [s.strip() for s in str(raw_skills).split(',')] if raw_skills else []
                
                try:
                    max_hrs = int(float(str(max_hrs).strip())) if max_hrs else 40
                except (ValueError, TypeError):
                    max_hrs = 40
                
                pref_shift = str(pref_shift).strip() if pref_shift else 'Morning'
                weekly_off = str(weekly_off).strip().capitalize() if weekly_off else None

                existing = db.query(Employee).filter(Employee.emp_id == emp_id).first()
                if existing:
                    existing.name            = name
                    existing.skills          = skills
                    existing.preferred_shift = pref_shift
                    existing.max_hours       = max_hrs
                    existing.weekly_off      = weekly_off
                    updated += 1
                else:
                    db.add(Employee(
                        emp_id=emp_id, name=name, skills=skills,
                        preferred_shift=pref_shift, max_hours=max_hrs,
                        weekly_off=weekly_off
                    ))
                    inserted += 1
            else:
                # If row is totally empty or unidentifiable, we only skip if literally no data exists
                if any(v for v in row_dict.values() if v is not None):
                    # Try to use whatever is in the first column as a name
                    fallback_val = list(row_dict.values())[0]
                    if fallback_val:
                        emp_id = f"ROW-{idx+1}"
                        name   = str(fallback_val)
                        db.add(Employee(emp_id=emp_id, name=name, skills=[], preferred_shift='Morning', max_hours=40))
                        inserted += 1
                    else:
                        skipped += 1
                else:
                    skipped += 1

            # ── Shift timing (LOOSE VALIDATION) ───────────────────────────
            shift_name = _get(row_dict, COL_SHIFT_NAME)
            start_time = _get(row_dict, COL_START_TIME)
            end_time   = _get(row_dict, COL_END_TIME)

            if shift_name and shift_name not in processed_shift_names:
                shift_name = str(shift_name).strip()
                # Use defaults if times are missing
                start_time = str(start_time).strip() if start_time else "09:00"
                end_time   = str(end_time).strip() if end_time else "17:00"
                
                existing_s = db.query(Shift).filter(Shift.name == shift_name).first()
                if existing_s:
                    existing_s.start_time = start_time
                    existing_s.end_time   = end_time
                else:
                    db.add(Shift(
                        name=shift_name, 
                        start_time=start_time, 
                        end_time=end_time,
                        required_employees=2
                    ))
                processed_shift_names.add(shift_name)
        except Exception as e:
            print(f"[Parser] Error processing row {idx}: {e}")
            skipped += 1

    db.commit()
    return f"{inserted} new, {updated} updated, {skipped} skipped"

def parse_employees_excel(file_path: str, db: Session):
    """Wrapper for main.py compatibility."""
    return parse_combined_excel(file_path, db)

def parse_shifts_excel(file_path: str, db: Session):
    """Wrapper for main.py compatibility."""
    return parse_combined_excel(file_path, db)

def clear_all_operational_data(db: Session):
    """Deletes all existing operational data from the database."""
    try:
        db.query(Schedule).delete()
        db.query(Leave).delete()
        db.query(Employee).delete()
        db.query(Shift).delete()
        db.commit()
        print("[DB] Cleared all operational data (Employees, Shifts, Schedules, Leaves).")
    except Exception as e:
        db.rollback()
        print(f"[DB] Error clearing data: {e}")

def ensure_default_shifts(db: Session):
    """Ensures at least the 4 standard shifts exist if none are provided in Excel."""
    count = db.query(Shift).count()
    if count == 0:
        defaults = [
            ("Morning", "06:00", "12:00"),
            ("Afternoon", "12:00", "18:00"),
            ("Evening", "18:00", "00:00"),
            ("Night", "00:00", "06:00")
        ]
        for name, start, end in defaults:
            db.add(Shift(name=name, start_time=start, end_time=end, required_employees=2))
        db.commit()
        print("[DB] No shifts found. Seeded 4 default shifts.")


def _shift_hours(start: str, end: str) -> int:
    """Calculate shift duration in hours, handling midnight crossover."""
    try:
        sh, sm = map(int, start.split(':'))
        eh, em = map(int, end.split(':'))
        start_mins = sh * 60 + sm
        end_mins   = eh * 60 + em
        if end_mins <= start_mins:      # crosses midnight
            end_mins += 24 * 60
        return max(1, (end_mins - start_mins) // 60)
    except Exception:
        return 6


def _get_historical_hours(db: Session, emp_ids: list, days: int = 7) -> dict:
    """
    Returns dict of {employee_id: total_hours_last_N_days}
    Optimized with single query.
    """
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    # Fetch all relevant schedules and shifts in one go
    past = (
        db.query(Schedule.employee_id, Shift.start_time, Shift.end_time)
        .join(Shift, Schedule.shift_id == Shift.id)
        .filter(Schedule.date >= cutoff)
        .filter(Schedule.date < date.today().isoformat())
        .all()
    )
    
    hours = {eid: 0 for eid in emp_ids}
    for eid, start, end in past:
        if eid in hours:
            hours[eid] += _shift_hours(start, end)
    return hours


def _get_recent_shift_assignments(db: Session, emp_ids: list, days: int = 2) -> dict:
    """
    Returns {employee_id: [shift_name, ...]} for the last N days.
    Used to avoid consecutive same-shift assignment (e.g., 3 nights in a row).
    """
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    past = (
        db.query(Schedule.employee_id, Shift.name)
        .join(Shift, Schedule.shift_id == Shift.id)
        .filter(Schedule.date >= cutoff)
        .filter(Schedule.date < date.today().isoformat())
        .all()
    )
    history = {eid: [] for eid in emp_ids}
    for emp_id, shift_name in past:
        if emp_id in history:
            history[emp_id].append(shift_name)
    return history


def generate_ai_schedule(db: Session, target_date: str = None, force_refresh: bool = False):
    """
    AI Scheduling Engine — Optimized version.
    """
    if not target_date:
        target_date = date.today().isoformat()

    # Check cache first
    now = time.time()
    if not force_refresh and target_date in _schedule_cache:
        cached_val, timestamp = _schedule_cache[target_date]
        if now - timestamp < _cache_expiry:
            print(f"[AI] Returning cached schedule for {target_date}")
            return

    start_time_bench = time.time()
    
    # 1. Prefetch all data in bulk
    employees = db.query(Employee).all()
    departments = db.query(Department).all()
    
    # AI Auto-assign weekly offs if any employee doesn't have one
    if any(e.weekly_off is None for e in employees):
        auto_assign_weekly_offs(db)
        employees = db.query(Employee).all() # Refresh

    shifts    = db.query(Shift).all()
    leaves    = db.query(Leave).filter(Leave.date == target_date).all()
    leave_ids = {l.employee_id for l in leaves}
    
    # Group employees by department for department-wise scheduling
    employees_by_dept = {}
    for emp in employees:
        dept_id = emp.department_id or 0  # 0 for unassigned
        if dept_id not in employees_by_dept:
            employees_by_dept[dept_id] = []
        employees_by_dept[dept_id].append(emp)

    # 2. Bulk fetch days worked to avoid N+1 query
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    days_worked_query = (
        db.query(Schedule.employee_id, func.count(func.distinct(Schedule.date)))
        .filter(Schedule.date >= week_start, Schedule.date < target_date)
        .group_by(Schedule.employee_id)
        .all()
    )
    days_worked = {eid: count for eid, count in days_worked_query}
    for emp in employees:
        if emp.id not in days_worked:
            days_worked[emp.id] = 0

    # 1.1 Filter employees based on weekly off day
    import datetime
    target_date_obj = datetime.date.fromisoformat(target_date)
    day_name = target_date_obj.strftime('%A') # e.g. 'Monday'

    # Clear today's existing schedule
    db.query(Schedule).filter(Schedule.date == target_date).delete()
    db.flush()

    # Employees who are NOT on weekly off today AND not on leave
    available = []
    for e in employees:
        if e.id in leave_ids:
            continue
            
        is_off = False
        if e.weekly_off:
            if e.weekly_off.strip().lower() == day_name.lower():
                is_off = True
        
        if not is_off:
            available.append(e)
    if not available or not shifts:
        db.commit()
        return

    emp_ids      = [e.id for e in available]
    shift_dur    = {s.id: _shift_hours(s.start_time, s.end_time) for s in shifts}

    # 3. Batch fetch historical data
    hist_hours   = _get_historical_hours(db, emp_ids, days=7)
    recent_shifts = _get_recent_shift_assignments(db, emp_ids, days=2)
    
    shift_assignments = {s.id: [] for s in shifts}
    employee_hours    = {e.id: 0 for e in available}
    assigned_emps     = set()
    
    WEEKLY_OFF_LIMIT = 143

    # Pre-calculate scores for all emp-shift pairs to speed up sorting
    # This avoids repeated lookups and function calls during sort
    precomputed_scores = {}
    for emp in available:
        precomputed_scores[emp.id] = {}
        h_hours = hist_hours.get(emp.id, 0)
        d_worked = days_worked.get(emp.id, 0)
        r_shifts = recent_shifts.get(emp.id, [])
        
        for shift in shifts:
            score = h_hours
            if emp.preferred_shift != shift.name:
                score += 100
            if shift.name == 'Night' and emp.preferred_shift == 'Night':
                score -= 50
            if r_shifts.count(shift.name) >= 2:
                score += 200
            if d_worked >= 6:
                score += 150
            precomputed_scores[emp.id][shift.id] = score

    # ── Phase 1: Department-wise Preferred shifts ──────────────────────────────────
    available_ids = {e.id for e in available}
    for dept_id, dept_employees in employees_by_dept.items():
        dept = next((d for d in departments if d.id == dept_id), None) if dept_id != 0 else None
        min_staff = dept.min_staff_per_shift if dept else 1
        
        # Filter available employees for this department (must be in available set)
        dept_available = [e for e in dept_employees if e.id in available_ids and e.id not in leave_ids and e.id not in assigned_emps]
        
        for shift in shifts:
            preferred = [
                e for e in dept_available
                if e.preferred_shift == shift.name and e.id not in assigned_emps and e.id in precomputed_scores
            ]
            preferred.sort(key=lambda e: precomputed_scores[e.id].get(shift.id, 1000))

            for emp in preferred:
                if len(shift_assignments[shift.id]) >= shift.required_employees:
                    break
                dur = shift_dur[shift.id]
                if employee_hours[emp.id] + dur <= emp.max_hours:
                    shift_assignments[shift.id].append(emp.id)
                    employee_hours[emp.id] += dur
                    assigned_emps.add(emp.id)
                    dept_available.remove(emp)

    # ── Phase 2: Department-wise Fill required slots ─────────────────────────────
    for dept_id, dept_employees in employees_by_dept.items():
        dept = next((d for d in departments if d.id == dept_id), None) if dept_id != 0 else None
        min_staff = dept.min_staff_per_shift if dept else 1
        
        # Filter available employees for this department (MUST be in available_ids set)
        dept_available = [e for e in dept_employees if e.id in available_ids and e.id not in leave_ids and e.id not in assigned_emps]
        
        for shift in shifts:
            # Ensure minimum staff per department for each shift
            dept_assigned = [eid for eid in shift_assignments[shift.id] 
                           if next((e for e in dept_employees if e.id == eid), None)]
            
            while len(dept_assigned) < min_staff and dept_available:
                candidates = dept_available.copy()
                if not candidates:
                    break
                # Only sort candidates that have precomputed scores
                candidates = [c for c in candidates if c.id in precomputed_scores]
                if not candidates:
                    break
                candidates.sort(key=lambda e: precomputed_scores[e.id].get(shift.id, 1000))
                dur = shift_dur[shift.id]
                valid = [c for c in candidates if c.id in employee_hours and employee_hours[c.id] + dur <= c.max_hours]
                if not valid and not candidates:
                    break
                chosen = (valid or candidates)[0]
                shift_assignments[shift.id].append(chosen.id)
                if chosen.id not in employee_hours:
                    employee_hours[chosen.id] = 0
                employee_hours[chosen.id] += dur
                assigned_emps.add(chosen.id)
                dept_assigned.append(chosen.id)
                # Safely remove from dept_available
                if chosen in dept_available:
                    dept_available.remove(chosen)
            
            # Fill remaining slots if needed
            while len(shift_assignments[shift.id]) < shift.required_employees:
                all_candidates = [e for e in available if e.id not in assigned_emps]
                if not all_candidates:
                    break
                all_candidates.sort(key=lambda e: precomputed_scores[e.id].get(shift.id, 1000))
                dur = shift_dur[shift.id]
                valid = [c for c in all_candidates if employee_hours[c.id] + dur <= c.max_hours]
                chosen = (valid or all_candidates)[0]
                shift_assignments[shift.id].append(chosen.id)
                employee_hours[chosen.id] += dur
                assigned_emps.add(chosen.id)
                # Remove from any department list
                for dept_list in employees_by_dept.values():
                    if chosen in dept_list:
                        dept_list.remove(chosen)
                        break

    # ── Phase 3: Remaining ───────────────────────────────────────────────────
    weekly_off_count = 0
    for emp in available:
        if emp.id not in assigned_emps:
            if days_worked.get(emp.id, 0) >= 6:
                weekly_off_count += 1
                continue
            
            if weekly_off_count >= WEEKLY_OFF_LIMIT:
                target = min(shifts, key=lambda s: len(shift_assignments[s.id]))
                shift_assignments[target.id].append(emp.id)
                assigned_emps.add(emp.id)
            else:
                if days_worked.get(emp.id, 0) >= 5:
                    weekly_off_count += 1
                    continue
                target = min(shifts, key=lambda s: len(shift_assignments[s.id]))
                shift_assignments[target.id].append(emp.id)
                assigned_emps.add(emp.id)

    for shift_id, emp_ids_list in shift_assignments.items():
        for emp_id in emp_ids_list:
            db.add(Schedule(date=target_date, shift_id=shift_id, employee_id=emp_id))

    db.commit()
    _log_schedule(shift_assignments, shifts, available, hist_hours)


def _log_schedule(assignments, shifts, employees, hist_hours):
    id_to_name  = {e.id: f"{e.name} ({e.emp_id})" for e in employees}
    id_to_shift = {s.id: s.name for s in shifts}
    total = sum(len(v) for v in assignments.values())
    print(f"\n[AI Scheduler] Schedule generated — {total} assignments:")
    for sid, eids in assignments.items():
        names = [id_to_name.get(eid, str(eid)) for eid in eids]
        print(f"  {id_to_shift.get(sid, sid)}: {', '.join(names) or 'EMPTY'}")
    print(f"  Weekly hours context used: {len(hist_hours)} employees")


def reassign_shift(db: Session, leave_employee_id: int, leave_date: str):
    """
    STRICT Prioritized Replacement Logic:
    1. Week-off employees (highest priority)
    2. Employees with no shift assigned that day
    3. Employees with least workload
    """
    # 1. Find the shift the leave employee was supposed to work
    sched = db.query(Schedule).filter(
        Schedule.employee_id == leave_employee_id,
        Schedule.date == leave_date
    ).first()

    if not sched:
        print(f"[AI] No shift found for employee {leave_employee_id} on {leave_date}. No reassignment needed.")
        return

    shift_id = sched.shift_id
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    leave_emp = db.query(Employee).filter(Employee.id == leave_employee_id).first()
    
    # 2. Identify all candidates
    all_emps = db.query(Employee).all()
    
    # Exclude those on leave today
    leave_ids = {l.employee_id for l in db.query(Leave).filter(Leave.date == leave_date).all()}
    leave_ids.add(leave_employee_id)
    
    # Identify who has NO shift today
    busy_ids = {s.employee_id for s in db.query(Schedule).filter(Schedule.date == leave_date).all()}
    
    # Candidates are those NOT on leave and NOT already working in another shift today
    # (The user says "no shift assigned that day", so if they work any shift, they are busy)
    candidates = [e for e in all_emps if e.id not in leave_ids and e.id not in (busy_ids - {leave_employee_id})]
    
    if not candidates:
        print(f"[AI] CRITICAL: No available candidates to replace {leave_emp.name} on {leave_date}")
        return

    # 3. Calculate metrics for prioritization
    import datetime
    target_date_obj = datetime.date.fromisoformat(leave_date)
    day_name = target_date_obj.strftime('%A')
    
    # Debug: Log week-off candidates
    week_off_candidates = [e for e in candidates if e.weekly_off == day_name]
    print(f"[AI] Available Week-off candidates for {day_name}: {[e.name for e in week_off_candidates]}")
    
    # Current week start for shift counts/hours
    week_start = (target_date_obj - timedelta(days=target_date_obj.weekday())).isoformat()
    
    # Total shifts this week for each candidate
    shift_counts = {
        eid: count for eid, count in 
        db.query(Schedule.employee_id, func.count(Schedule.id))
        .filter(Schedule.date >= week_start)
        .group_by(Schedule.employee_id).all()
    }
    
    # Historical replacement counts
    replacement_counts = {
        eid: count for eid, count in
        db.query(Schedule.employee_id, func.count(Schedule.id))
        .filter(Schedule.is_override == True)
        .group_by(Schedule.employee_id).all()
    }

    def get_score(emp):
        # We want the LOWEST score to win
        score = 0
        
        # Priority 1: Week-off (Highest Priority - heavy negative weight)
        if emp.weekly_off == day_name:
            score -= 10000 
        
        # Priority 2: No shift today 
        # (Since all candidates already have no shift today, we differentiate by workload)
        
        # Priority 3: Least total shifts (Workload)
        workload = shift_counts.get(emp.id, 0)
        score += workload * 100
        
        # Constraint: Skill match (Optional preference)
        if leave_emp.skills and emp.skills:
            if any(s in emp.skills for s in leave_emp.skills):
                score -= 500
        
        # Constraint: Avoid repeated replacement
        score += replacement_counts.get(emp.id, 0) * 1000
        
        return score

    # Sort candidates
    candidates.sort(key=get_score)
    
    # 4. Final selection with max_hours constraint
    dur = _shift_hours(shift.start_time, shift.end_time)
    final_replacement = None
    for c in candidates:
        # Check weekly hours
        current_hours = _get_historical_hours(db, [c.id], days=7).get(c.id, 0)
        if current_hours + dur <= c.max_hours:
            final_replacement = c
            break
            
    if final_replacement:
        # Update specific shift only
        sched.employee_id = final_replacement.id
        sched.is_override = True
        sched.replaced_employee_id = leave_employee_id
        db.commit()
        print(f"[AI] Replacement Success: {final_replacement.name} (Week-off: {final_replacement.weekly_off == day_name}) replaced {leave_emp.name} for {shift.name}")
    else:
        print(f"[AI] FAILED: No candidate found within constraints for {leave_emp.name}")


def handle_leave_request(db: Session, employee_id: int, leave_date: str):
    """
    Handle leave request:
    - If employee requesting leave is scheduled, reassign their shift to someone else.
    - Prioritizes people whose weekly off is today.
    """
    # Check if requesting employee is scheduled on leave date
    schedules = db.query(Schedule).filter(
        Schedule.employee_id == employee_id,
        Schedule.date == leave_date
    ).all()
    
    if schedules:
        # Employee is scheduled - reassign their shift
        reassign_shift(db, employee_id, leave_date)
    else:
        # Employee is not scheduled (already on weekly off or otherwise off)
        # Just ensure they are not scheduled (though reassign_shift handles this too)
        print(f"[AI] Leave request for {employee_id} on {leave_date} - Employee was already not scheduled.")



def handle_leave_cancellation(db: Session, employee_id: int, leave_date: str):
    """
    Handle leave cancellation:
    - If leave requester was assigned to work (from weekly off), give weekly off back to replacement person
    - Restore original schedule if possible
    """
    # Find if employee was assigned to work on leave date (from weekly off swap)
    schedules = db.query(Schedule).filter(
        Schedule.employee_id == employee_id,
        Schedule.date == leave_date
    ).all()
    
    if schedules:
        # Employee was assigned to work - check if this was from weekly off swap
        # Find who was replaced (who got weekly off)
        # This is tracked by checking if the employee was not originally scheduled
        week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        
        for sched in schedules:
            # Delete the assignment
            db.delete(sched)
            db.flush()
            
            # Try to find the original employee who was replaced
            # In a real system, we'd track this in a separate table or log
            # For now, we'll re-run the schedule generation for that day
            print(f"[AI] Leave cancelled for {emp.name} on {leave_date}. Regenerating schedule...")
            generate_ai_schedule(db, leave_date)
            break
    
    db.commit()


def validate_weekly_off_swap(db: Session, employee_1_id: int, employee_2_id: int, target_off_day: str):
    """
    AI Validation for weekly off swap requests:
    - Check shift coverage
    - Check employee workload
    - Check leave conflicts
    - Check max weekly hours
    - Check replacement availability
    - Check weekly off limit (143 employees per day)
    
    Returns validation status with details
    """
    WEEKLY_OFF_LIMIT = 143
    
    validation_status = {
        "valid": True,
        "shift_coverage": True,
        "workload_balance": True,
        "leave_conflicts": False,
        "max_hours": True,
        "weekly_off_limit": True,
        "details": []
    }
    
    emp1 = db.query(Employee).filter(Employee.id == employee_1_id).first()
    emp2 = db.query(Employee).filter(Employee.id == employee_2_id).first()
    
    if not emp1 or not emp2:
        validation_status["valid"] = False
        validation_status["details"].append("Employee not found")
        return validation_status
    
    # Check if both employees have different weekly off days
    if emp1.weekly_off == emp2.weekly_off:
        validation_status["valid"] = False
        validation_status["details"].append(f"Both employees already have the same weekly off: {emp1.weekly_off}")
        return validation_status
    
    # Check if target_off_day matches employee 2's current weekly off
    if emp2.weekly_off != target_off_day:
        validation_status["valid"] = False
        validation_status["details"].append(f"Target off day {target_off_day} does not match {emp2.name}'s current off day ({emp2.weekly_off})")
        return validation_status
    
    # Check weekly off limit for target day
    all_employees = db.query(Employee).all()
    employees_with_target_off = len([e for e in all_employees if e.weekly_off == target_off_day])
    if employees_with_target_off >= WEEKLY_OFF_LIMIT:
        validation_status["weekly_off_limit"] = False
        validation_status["valid"] = False
        validation_status["details"].append(f"Weekly off limit reached for {target_off_day}: {employees_with_target_off}/{WEEKLY_OFF_LIMIT}")
    
    # Check leave conflicts for both employees
    leaves_emp1 = db.query(Leave).filter(Leave.employee_id == employee_1_id).all()
    leaves_emp2 = db.query(Leave).filter(Leave.employee_id == employee_2_id).all()
    
    if leaves_emp1:
        validation_status["leave_conflicts"] = True
        validation_status["details"].append(f"{emp1.name} has pending leave requests")
    
    if leaves_emp2:
        validation_status["leave_conflicts"] = True
        validation_status["details"].append(f"{emp2.name} has pending leave requests")
    
    # Check workload balance (historical hours)
    from datetime import timedelta
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    
    emp1_schedules = db.query(Schedule).filter(
        Schedule.employee_id == employee_1_id,
        Schedule.date >= week_start,
        Schedule.date < date.today().isoformat()
    ).all()
    
    emp2_schedules = db.query(Schedule).filter(
        Schedule.employee_id == employee_2_id,
        Schedule.date >= week_start,
        Schedule.date < date.today().isoformat()
    ).all()
    
    emp1_days_worked = len(set(s.date for s in emp1_schedules))
    emp2_days_worked = len(set(s.date for s in emp2_schedules))
    
    if abs(emp1_days_worked - emp2_days_worked) > 2:
        validation_status["workload_balance"] = False
        validation_status["valid"] = False
        validation_status["details"].append(f"Workload imbalance: {emp1.name} worked {emp1_days_worked} days, {emp2.name} worked {emp2_days_worked} days")
    
    # Check shift coverage for target day
    shifts = db.query(Shift).all()
    for shift in shifts:
        scheduled_count = len(db.query(Schedule).filter(
            Schedule.date == target_off_day,
            Schedule.shift_id == shift.id
        ).all())
        
        if scheduled_count < shift.required_employees:
            validation_status["shift_coverage"] = False
            validation_status["valid"] = False
            validation_status["details"].append(f"Insufficient coverage for {shift.name} on {target_off_day}")
    
    if validation_status["valid"]:
        validation_status["details"].append("Swap request is valid and can be approved")
    
    return validation_status


def validate_overtime_request(db: Session, employee_id: int, date: str, overtime_hours: float) -> dict:
    """
    AI validation for overtime requests
    
    Returns:
        {
            "valid": bool,
            "score": int (0-100),
            "reasons": List[str],
            "details": Dict[str, Any]
        }
    """
    validation_status = {
        "valid": True,
        "score": 100,
        "reasons": [],
        "details": {}
    }
    
    # Check if employee exists
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        validation_status["valid"] = False
        validation_status["score"] = 0
        validation_status["reasons"].append("Employee not found")
        return validation_status
    
    validation_status["details"]["employee"] = employee.name
    validation_status["details"]["department"] = employee.department.name if employee.department else "Unassigned"
    
    # Check leave conflicts
    leave = db.query(Leave).filter(Leave.employee_id == employee_id, Leave.date == date).first()
    if leave:
        validation_status["valid"] = False
        validation_status["score"] -= 40
        validation_status["reasons"].append(f"Employee is on leave on {date}")
    
    # Check weekly overtime limit
    from datetime import datetime, timedelta
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    week_start = date_obj - timedelta(days=date_obj.weekday())
    week_start_str = week_start.strftime("%Y-%m-%d")
    
    existing_overtime = db.query(OvertimeLog).filter(
        OvertimeLog.employee_id == employee_id,
        OvertimeLog.week_start_date == week_start_str,
        OvertimeLog.status == "approved"
    ).all()
    
    total_overtime_hours = sum(ot.overtime_hours for ot in existing_overtime) + overtime_hours
    max_overtime_weekly = employee.department.max_overtime_weekly if employee.department else 10
    
    if total_overtime_hours > max_overtime_weekly:
        validation_status["valid"] = False
        validation_status["score"] -= 50
        validation_status["reasons"].append(f"Weekly overtime limit exceeded: {total_overtime_hours} > {max_overtime_weekly} hours")
    
    validation_status["details"]["current_week_overtime"] = total_overtime_hours - overtime_hours
    validation_status["details"]["requested_overtime"] = overtime_hours
    validation_status["details"]["total_after_approval"] = total_overtime_hours
    validation_status["details"]["weekly_limit"] = max_overtime_weekly
    
    # Check department staffing availability
    if employee.department:
        department_employees = db.query(Employee).filter(Employee.department_id == employee.department.id).all()
        department_ids = [emp.id for emp in department_employees]
        
        # Check if other employees are available on the same day
        schedules_on_date = db.query(Schedule).filter(
            Schedule.date == date,
            Schedule.employee_id.in_(department_ids)
        ).all()
        
        available_employees = len(department_employees) - len(schedules_on_date)
        min_staff_required = employee.department.min_staff_per_shift
        
        if available_employees < min_staff_required:
            validation_status["valid"] = False
            validation_status["score"] -= 30
            validation_status["reasons"].append(f"Insufficient department staffing: {available_employees} available, {min_staff_required} required")
    
    # Check workload balance (hours worked in the week)
    week_schedules = db.query(Schedule).filter(
        Schedule.employee_id == employee_id,
        Schedule.date >= week_start_str,
        Schedule.date < (week_start + timedelta(days=7)).strftime("%Y-%m-%d")
    ).all()
    
    # Calculate weekly hours (8 hours per scheduled day + existing overtime)
    weekly_hours = len(week_schedules) * 8 + sum(ot.overtime_hours for ot in existing_overtime)
    weekly_hours_after = weekly_hours + overtime_hours
    
    if weekly_hours_after > 60:  # Maximum 60 hours per week
        validation_status["valid"] = False
        validation_status["score"] -= 40
        validation_status["reasons"].append(f"Weekly hours limit exceeded: {weekly_hours_after} > 60 hours")
    
    validation_status["details"]["current_week_hours"] = weekly_hours
    validation_status["details"]["hours_after_overtime"] = weekly_hours_after
    
    # Calculate final score
    if validation_status["valid"]:
        # Bonus points for reasonable overtime
        if overtime_hours <= 2:
            validation_status["score"] = min(100, validation_status["score"] + 10)
        elif overtime_hours <= 4:
            validation_status["score"] = min(100, validation_status["score"] + 5)
        
        validation_status["reasons"].append("Overtime request is valid and can be approved")
    else:
        validation_status["score"] = max(0, validation_status["score"])
    
    return validation_status
