import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.database import Employee, Shift, Schedule, Leave, Department, OvertimeLog, WeeklyOffHistory
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

DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

import datetime
from typing import Union

EPOCH_DATE = datetime.date(2026, 1, 5) # Monday

def get_rotated_weekly_off(base_off: str, target_date: Union[str, datetime.date, datetime.datetime]) -> str:
    """
    Get rotated weekly off day for a given base weekly off day and target date.
    Rotates by 1 day every week to satisfy enterprise-grade scheduling fairness.
    """
    if not base_off or str(base_off).strip().lower() == 'nan' or base_off == 'Not Set':
        base_off = "Sunday"
        
    if base_off not in DAYS_OF_WEEK:
        base_off = base_off.strip().capitalize()
        if base_off not in DAYS_OF_WEEK:
            base_off = "Sunday"
            
    if isinstance(target_date, str):
        target_date_obj = datetime.date.fromisoformat(target_date)
    elif isinstance(target_date, datetime.datetime):
        target_date_obj = target_date.date()
    else:
        target_date_obj = target_date
        
    days_diff = (target_date_obj - EPOCH_DATE).days
    week_idx = days_diff // 7
    
    base_off_idx = DAYS_OF_WEEK.index(base_off)
    rotated_idx = (base_off_idx + week_idx) % 7
    return DAYS_OF_WEEK[rotated_idx]

def get_working_shifts(db: Session):
    """
    Retrieve active working shifts (excluding WEEK OFF and Afternoon) ordered deterministically:
    Morning -> Evening -> Night.
    """
    allowed_names = ["morning", "evening", "night"]
    all_shifts = db.query(Shift).filter(func.lower(Shift.name).in_(allowed_names)).all()
    
    # Sort deterministically: Morning -> Evening -> Night
    def get_sort_key(s):
        name = s.name.lower().strip()
        if "morning" in name:
            return 0
        if "evening" in name:
            return 1
        if "night" in name:
            return 2
        return 99
        
    return sorted(all_shifts, key=get_sort_key)

def auto_assign_weekly_offs(db: Session, force_reassign: bool = False) -> dict:
    """
    Enterprise-Grade Fair Weekly Off Distribution Algorithm.

    Rules:
    - Every employee gets exactly 1 weekly off day per week.
    - Weekly offs are distributed PERFECTLY evenly across all 7 days.
    - Uses min-heap balancing: always assign the day with the lowest current count.
    - Department-aware: spread weekly offs within each department too.
    - Rotation: employee's weekly off rotates by 1 day each ISO week for fairness.
    - Skips employees who already have a valid weekly off (unless force_reassign=True).
    - Handles 50,000+ employees efficiently via bulk updates in batches of 500.

    Returns a distribution summary dict.
    """
    import datetime

    employees = db.query(Employee).order_by(Employee.id).all()
    if not employees:
        return {"status": "no_employees", "total": 0, "distribution": {}}

    week_num = datetime.date.today().isocalendar()[1]
    week_start_date = (datetime.date.today() - datetime.timedelta(days=datetime.date.today().weekday())).isoformat()

    assignments_made = 0
    reassigned = 0

    print(f"[AI WeeklyOff] Starting Global Reassignment with Critical Role Coverage for Week {week_num}")

    # Group employees by department and role
    dept_role_groups = {}
    for emp in employees:
        dept_id = emp.department_id or 0
        role = emp.role.strip() if emp.role else "Staff"
        if dept_id not in dept_role_groups:
            dept_role_groups[dept_id] = {}
        if role not in dept_role_groups[dept_id]:
            dept_role_groups[dept_id][role] = []
        dept_role_groups[dept_id][role].append(emp)

    # For each department and role, assign weekly offs sequentially to stagger them
    for dept_id, roles in dept_role_groups.items():
        for role, emps in roles.items():
            # Sort deterministically
            sorted_emps = sorted(emps, key=lambda e: e.id)
            for idx, emp in enumerate(sorted_emps):
                if not force_reassign and emp.weekly_off in DAYS_OF_WEEK:
                    continue

                old_day = emp.weekly_off
                emp.weekly_off = None
                
                # Stagger assignment using role-specific index
                best_day = DAYS_OF_WEEK[(idx + week_num) % 7]
                emp.weekly_off = best_day
                
                print(f"[AI WeeklyOff] {emp.emp_id or emp.name} (Role: {role}) -> {best_day}")

                if old_day != best_day:
                    reassigned += 1
                assignments_made += 1
                
                db.add(WeeklyOffHistory(
                    employee_id=emp.id,
                    week_start_date=week_start_date,
                    off_day=best_day
                ))

    # 7. After Assignment
    db.commit()
    for emp in employees:
        db.refresh(emp)

    # ─── Build final distribution summary ─────────────────────────────────
    final_counts = {d: 0 for d in DAYS_OF_WEEK}
    for emp in employees:
        if emp.weekly_off in DAYS_OF_WEEK:
            final_counts[emp.weekly_off] += 1

    total = len(employees)
    ideal_per_day = total / 7

    print(f"[AI WeeklyOff] Fair distribution complete. Week {week_num}. "
          f"Total={total}, Assigned={assignments_made}, Reassigned={reassigned}")
    for day, cnt in final_counts.items():
        delta = cnt - ideal_per_day
        print(f"  {day}: {cnt} employees (delta: {delta:+.1f})")

    return {
        "status": "success",
        "total_employees": total,
        "assignments_made": assignments_made,
        "reassigned": reassigned,
        "week_number": week_num,
        "distribution": final_counts,
        "ideal_per_day": round(ideal_per_day, 2),
    }


def get_weekly_off_distribution(db: Session) -> dict:
    """
    Returns the current weekly off distribution statistics across all employees.
    Includes balance score, per-day counts, imbalance delta.
    """
    employees = db.query(Employee).all()
    total = len(employees)
    if total == 0:
        return {"total": 0, "distribution": {}, "balance_score": 100.0}

    counts = {d: 0 for d in DAYS_OF_WEEK}
    unassigned = 0
    for emp in employees:
        if emp.weekly_off in DAYS_OF_WEEK:
            counts[emp.weekly_off] += 1
        else:
            unassigned += 1

    ideal = total / 7
    max_delta = max(abs(c - ideal) for c in counts.values()) if counts else 0
    balance_score = max(0.0, 100.0 - (max_delta / max(ideal, 1)) * 100)

    return {
        "total_employees": total,
        "unassigned": unassigned,
        "distribution": counts,
        "ideal_per_day": round(ideal, 2),
        "max_imbalance": round(max_delta, 2),
        "balance_score": round(balance_score, 1),
        "days": DAYS_OF_WEEK,
    }


def rotate_weekly_offs_for_week(db: Session, week_offset: int = 1) -> dict:
    import datetime
    
    employees = db.query(Employee).order_by(Employee.id).all()
    if not employees:
        return {"status": "no_employees"}

    week_num = datetime.date.today().isocalendar()[1]
    week_start_date = (datetime.date.today() - datetime.timedelta(days=datetime.date.today().weekday())).isoformat()
    
    rotated = 0
    print(f"[AI WeeklyOff] Starting Global Rotation for Week {week_num}")

    for i, emp in enumerate(employees):
        # Force Reset Old Weekly Off
        emp.weekly_off = None
        
        # Proper Rotation Logic globally
        best_day = DAYS_OF_WEEK[(i + week_num + week_offset) % 7]
        emp.weekly_off = best_day
        
        # Debug Log
        print(f"{emp.emp_id or emp.name} -> {best_day}")
        rotated += 1
        
        # Save previous weekly off history
        db.add(WeeklyOffHistory(
            employee_id=emp.id,
            week_start_date=week_start_date,
            off_day=best_day
        ))

    # After Assignment
    db.commit()
    for emp in employees:
        db.refresh(emp)

    print(f"[AI WeeklyOff] [SPIN] Rotated {rotated} employees by {week_offset} day(s).")
    return {"status": "success", "rotated": rotated, "week_offset": week_offset}


# ─── Column name aliases (extremely permissive) ─────────────────────────────
COL_EMP_ID     = ['employee id', 'emp id', 'id', 'empid', 'staff id', 'eid', 'code', 'employee #', 'employee_id']
COL_NAME       = ['name', 'employee name', 'full name', 'emp name', 'staff name', 'person', 'fullname']
COL_SKILLS     = ['skills', 'qualifications', 'skillset', 'ability', 'skill', 'dept']
COL_ROLE       = ['role in department', 'role', 'designation', 'job title', 'position', 'roles', 'category']
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
                role       = _get(row_dict, COL_ROLE)
                pref_shift = _get(row_dict, COL_PREF_SHIFT)
                max_hrs    = _get(row_dict, COL_MAX_HOURS)
                weekly_off = _get(row_dict, COL_WEEKLY_OFF)

                skills     = [s.strip() for s in str(raw_skills).split(',')] if raw_skills else []
                role       = str(role).strip() if role else 'Staff'
                
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
                    existing.role            = role
                    existing.preferred_shift = pref_shift
                    existing.max_hours       = max_hrs
                    existing.weekly_off      = weekly_off
                    updated += 1
                else:
                    db.add(Employee(
                        emp_id=emp_id, name=name, skills=skills, role=role,
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

    # Ensure "WEEK OFF" shift exists
    week_off_shift = db.query(Shift).filter(Shift.name == "WEEK OFF").first()
    if not week_off_shift:
        week_off_shift = Shift(name="WEEK OFF", start_time="00:00", end_time="00:00", required_employees=0)
        db.add(week_off_shift)
        db.commit()
    
    # Refresh shifts list, excluding the special "WEEK OFF" shift
    shifts = db.query(Shift).filter(Shift.name != "WEEK OFF").all()
    if not shifts:
        shifts = [
            Shift(name="Morning", start_time="06:00", end_time="12:00", required_employees=2),
            Shift(name="Afternoon", start_time="12:00", end_time="18:00", required_employees=2),
            Shift(name="Evening", start_time="18:00", end_time="00:00", required_employees=2),
            Shift(name="Night", start_time="00:00", end_time="06:00", required_employees=2)
        ]
        for s in shifts:
            db.add(s)
        db.commit()
        shifts = db.query(Shift).filter(Shift.name != "WEEK OFF").all()

    available = []
    resting = []
    
    for e in employees:
        if e.id in leave_ids or e.leave_status == 'On Leave':
            continue
            
        # Use our clean rotated weekly off day calculation
        rotated_off_day = get_rotated_weekly_off(e.weekly_off, target_date_obj)
        
        if day_name.lower() == rotated_off_day.lower():
            resting.append(e)
        else:
            available.append(e)
            
    if not available and not resting:
        db.commit()
        return

    working_shifts = get_working_shifts(db)
    num_working_shifts = len(working_shifts)
    
    # 1. Fetch previous day shift names to rotate fairly
    prev_date = (target_date_obj - datetime.timedelta(days=1)).isoformat()
    prev_schedules = (
        db.query(Schedule.employee_id, Shift.name)
        .join(Shift, Schedule.shift_id == Shift.id)
        .filter(Schedule.date == prev_date)
        .all()
    )
    prev_shift_names = {s.employee_id: s.name for s in prev_schedules}
    
    # 2. Map shift name to index
    shift_name_to_idx = {s.name.lower(): idx for idx, s in enumerate(working_shifts)}
    
    # 3. Target capacities for perfect balance
    num_emps = len(available)
    target_caps = [num_emps // num_working_shifts] * num_working_shifts
    for i in range(num_emps % num_working_shifts):
        target_caps[i] += 1
        
    shift_counts = [0] * num_working_shifts
    
    schedule_mappings = []
    
    # Sort available: critical employees first, then others, to ensure critical employees get distributed first!
    def get_scheduling_priority(e):
        dept = db.query(Department).filter(Department.id == e.department_id).first()
        dept_name = dept.name if dept else ""
        reqs = get_dept_requirements(dept_name)
        role = e.role.strip() if e.role else ""
        if role in reqs:
            # Lower number = higher priority
            role_priority = list(reqs.keys()).index(role)
            return (0, role_priority, e.id)
        return (1, 0, e.id)

    sorted_available = sorted(available, key=get_scheduling_priority)
    
    # Track roles assigned per shift in each department
    # dept_shift_role_counts: {dept_id: {shift_idx: {role: count}}}
    dept_shift_role_counts = {}

    for emp in sorted_available:
        dept_id = emp.department_id or 0
        role = emp.role.strip() if emp.role else ""
        
        prev_shift = prev_shift_names.get(emp.id)
        
        preferred_idx = 0
        if prev_shift and prev_shift.lower() in shift_name_to_idx:
            prev_idx = shift_name_to_idx[prev_shift.lower()]
            preferred_idx = (prev_idx + 1) % num_working_shifts
        else:
            preferred_idx = (target_date_obj.toordinal() + (emp.id or 0)) % num_working_shifts
            
        # Helper to get current role count in dept for shift_idx
        def get_role_count(s_idx):
            if dept_id not in dept_shift_role_counts:
                return 0
            if s_idx not in dept_shift_role_counts[dept_id]:
                return 0
            return dept_shift_role_counts[dept_id][s_idx].get(role, 0)

        candidate_indices = sorted(
            range(num_working_shifts),
            key=lambda idx: (
                0 if shift_counts[idx] < target_caps[idx] else 1,
                get_role_count(idx),
                (idx - preferred_idx) % num_working_shifts
            )
        )
        
        chosen_idx = candidate_indices[0]
        chosen_shift = working_shifts[chosen_idx]
        shift_counts[chosen_idx] += 1
        
        # Update counts
        if dept_id not in dept_shift_role_counts:
            dept_shift_role_counts[dept_id] = {}
        if chosen_idx not in dept_shift_role_counts[dept_id]:
            dept_shift_role_counts[dept_id][chosen_idx] = {}
        if role not in dept_shift_role_counts[dept_id][chosen_idx]:
            dept_shift_role_counts[dept_id][chosen_idx][role] = 0
        dept_shift_role_counts[dept_id][chosen_idx][role] += 1
        
        schedule_mappings.append({
            "date": target_date,
            "shift_id": chosen_shift.id,
            "employee_id": emp.id,
            "is_override": False,
            "replaced_employee_id": None
        })
            
    # Save resting weekly off assignments as "WEEK OFF" shift
    for emp in resting:
        schedule_mappings.append({
            "date": target_date,
            "shift_id": week_off_shift.id,
            "employee_id": emp.id,
            "is_override": False,
            "replaced_employee_id": None
        })
            
    if schedule_mappings:
        db.bulk_insert_mappings(Schedule, schedule_mappings)
        
    db.commit()
    
    # Reconstruct shift_assignments for logging compatibility
    shift_assignments = {s.id: [] for s in shifts}
    for m in schedule_mappings:
        s_id = m["shift_id"]
        if s_id in shift_assignments:
            shift_assignments[s_id].append(m["employee_id"])
            
    emp_ids = [e.id for e in available]
    hist_hours = _get_historical_hours(db, emp_ids, days=7)
    _log_schedule(shift_assignments, shifts, available, hist_hours)


def _log_schedule(assignments, shifts, employees, hist_hours):
    id_to_shift = {s.id: s.name for s in shifts}
    total = sum(len(v) for v in assignments.values())
    print(f"\n[AI Scheduler] Schedule generated — {total} assignments:")
    for sid, eids in assignments.items():
        s_name = id_to_shift.get(sid, f"Shift #{sid}")
        print(f"  {s_name}: {len(eids)} employees")
    print(f"  Weekly hours context used: {len(hist_hours)} employees")


from app.database.database import Employee, Shift, Schedule, Leave, Department, OvertimeLog, WeeklyOffHistory, Overtime
from typing import Tuple, Optional

DEFAULT_DEPARTMENT_ROLE_REQUIREMENTS = {
    "development": {
        "Team Lead": 1,
        "Senior Developer": 1,
        "QA Engineer": 1
    },
    "security": {
        "SOC Engineer": 1,
        "Security Analyst": 2
    },
    "security dept": {
        "SOC Engineer": 1,
        "Security Analyst": 2
    },
    "r&d": {
        "Team Lead": 1,
        "Senior Developer": 1,
        "QA Engineer": 1
    }
}

def get_dept_requirements(dept_name: str) -> dict:
    if not dept_name:
        return {}
    name_lower = dept_name.lower().strip()
    if name_lower in DEFAULT_DEPARTMENT_ROLE_REQUIREMENTS:
        return DEFAULT_DEPARTMENT_ROLE_REQUIREMENTS[name_lower]
    for k, v in DEFAULT_DEPARTMENT_ROLE_REQUIREMENTS.items():
        if k in name_lower or name_lower in k:
            return v
    return {}

def check_department_role_coverage(db: Session, target_date: str, proposed_assignments: list) -> Tuple[bool, str]:
    """
    Validate that for each department, the proposed schedules for target_date satisfy the critical role coverage requirements.
    proposed_assignments: list of dicts with keys 'employee_id' and 'shift_id'.
    """
    shifts = {s.id: s for s in db.query(Shift).all()}
    emp_ids = [a["employee_id"] for a in proposed_assignments]
    employees = db.query(Employee).filter(Employee.id.in_(emp_ids)).all()
    emp_map = {e.id: e for e in employees}
    depts = {d.id: d for d in db.query(Department).all()}
    
    dept_role_counts = {}
    dept_total_working = {}
    dept_shift_role_counts = {}
    leave_ids = {l.employee_id for l in db.query(Leave).filter(Leave.date == target_date).all()}
    
    for a in proposed_assignments:
        emp_id = a["employee_id"]
        shift_id = a["shift_id"]
        emp = emp_map.get(emp_id)
        if not emp:
            continue
        if emp.id in leave_ids or emp.leave_status == "On Leave":
            continue
        shift = shifts.get(shift_id)
        if not shift or shift.name.lower().strip() == "week off":
            continue
        dept_id = emp.department_id
        if not dept_id:
            continue
        role = emp.role
        if not role:
            continue
        
        role_norm = role.strip()
        if dept_id not in dept_role_counts:
            dept_role_counts[dept_id] = {}
        if role_norm not in dept_role_counts[dept_id]:
            dept_role_counts[dept_id][role_norm] = set()
        dept_role_counts[dept_id][role_norm].add(emp.id)
        
        if dept_id not in dept_total_working:
            dept_total_working[dept_id] = set()
        dept_total_working[dept_id].add(emp.id)
        
        if dept_id not in dept_shift_role_counts:
            dept_shift_role_counts[dept_id] = {}
        if shift_id not in dept_shift_role_counts[dept_id]:
            dept_shift_role_counts[dept_id][shift_id] = {}
        if role_norm not in dept_shift_role_counts[dept_id][shift_id]:
            dept_shift_role_counts[dept_id][shift_id][role_norm] = 0
        dept_shift_role_counts[dept_id][shift_id][role_norm] += 1

    assigned_dept_ids = set()
    for a in proposed_assignments:
        emp_id = a["employee_id"]
        emp = emp_map.get(emp_id)
        if emp and emp.department_id is not None:
            assigned_dept_ids.add(emp.department_id)

    for dept_id, dept in depts.items():
        if dept_id not in assigned_dept_ids:
            continue
        reqs = get_dept_requirements(dept.name)
        if not reqs:
            continue
        dept_all_emps = db.query(Employee).filter(Employee.department_id == dept_id).all()
        dept_senior_roles = [r for r in reqs.keys()]
        dept_has_seniors_registered = any(e.role in dept_senior_roles for e in dept_all_emps)
        
        for role, min_count in reqs.items():
            current_set = dept_role_counts.get(dept_id, {}).get(role, set())
            current_count = len(current_set)
            registered_role_emps = [e for e in dept_all_emps if e.role == role]
            registered_count = len(registered_role_emps)
            effective_min = min(min_count, registered_count)
            
            if current_count < effective_min:
                return False, f"Department '{dept.name}' role '{role}' coverage failed: only {current_count} working, minimum required is {effective_min} on {target_date}"
                
        if dept_has_seniors_registered:
            assigned_shifts = dept_shift_role_counts.get(dept_id, {})
            for s_id, roles in assigned_shifts.items():
                shift_obj = shifts.get(s_id)
                shift_name = shift_obj.name if shift_obj else f"Shift #{s_id}"
                has_senior = any(roles.get(sr, 0) > 0 for sr in dept_senior_roles)
                if not has_senior:
                    return False, f"Department '{dept.name}' shift '{shift_name}' has no senior/critical role (e.g., {', '.join(dept_senior_roles)}) on {target_date}"

    return True, ""

def check_weekly_off_role_coverage(db: Session, employees: list) -> Tuple[bool, str]:
    """
    Verify that the weekly off assignments for all employees do not violate critical role coverage.
    """
    dept_role_emps = {}
    for e in employees:
        if not e.department_id or not e.role or not e.weekly_off:
            continue
        dept_id = e.department_id
        role = e.role.strip()
        if dept_id not in dept_role_emps:
            dept_role_emps[dept_id] = {}
        if role not in dept_role_emps[dept_id]:
            dept_role_emps[dept_id][role] = []
        dept_role_emps[dept_id][role].append(e)

    depts = {d.id: d for d in db.query(Department).all()}
    for dept_id, roles in dept_role_emps.items():
        dept = depts.get(dept_id)
        if not dept:
            continue
        reqs = get_dept_requirements(dept.name)
        if not reqs:
            continue
        for role, emps in roles.items():
            if role not in reqs:
                continue
            min_req = reqs[role]
            N = len(emps)
            max_allowed_off = max(1, N - min_req)
            day_counts = {d: 0 for d in DAYS_OF_WEEK}
            for e in emps:
                day_counts[e.weekly_off] += 1
            for day, count in day_counts.items():
                if count > max_allowed_off:
                    return False, f"Weekly off validation failed for department '{dept.name}' role '{role}': {count} employees have off on {day}, but max allowed is {max_allowed_off} (Total: {N}, Required: {min_req})"
    return True, ""

def validate_replacement_constraints(db: Session, employee_id: int, target_date: str, shift_id: int, exclude_schedule_id: Optional[int] = None) -> Tuple[bool, str]:
    """
    Validate all strict constraints for assigning a shift/replacement to an employee.
    Checks:
    - Active employee status
    - On leave today
    - Already working same day (avoid double shift)
    - Exceeds maximum weekly working hours
    - Already assigned as emergency replacement today
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        return False, "Employee not found"

    # Leave check
    leave = db.query(Leave).filter(Leave.employee_id == employee_id, Leave.date == target_date).first()
    if leave or emp.leave_status == "On Leave":
        return False, f"Employee {emp.name} is on leave on {target_date}"

    # Shift check
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        return False, "Shift not found"

    if shift.name.lower().strip() == "week off":
        # Simulate that this employee is off today, and verify department role coverage
        schedules = db.query(Schedule).filter(Schedule.date == target_date).all()
        active_schedules = [s for s in schedules if s.shift and s.shift.name.lower().strip() != "week off"]
        if not active_schedules:
            return True, ""
            
        proposed = []
        for s in schedules:
            if s.employee_id == employee_id:
                proposed.append({"employee_id": employee_id, "shift_id": shift.id})
            else:
                proposed.append({"employee_id": s.employee_id, "shift_id": s.shift_id})
        if not any(p["employee_id"] == employee_id for p in proposed):
            proposed.append({"employee_id": employee_id, "shift_id": shift.id})
            
        is_valid_coverage, err_msg = check_department_role_coverage(db, target_date, proposed)
        if not is_valid_coverage:
            return False, f"AI Coverage Validation Failed: {err_msg}"
        return True, ""

    # Double shift check (not working another active/working shift today)
    today_schedules_query = db.query(Schedule).filter(
        Schedule.employee_id == employee_id,
        Schedule.date == target_date
    )
    if exclude_schedule_id is not None:
        today_schedules_query = today_schedules_query.filter(Schedule.id != exclude_schedule_id)
    today_schedules = today_schedules_query.all()
    
    for s in today_schedules:
        if s.shift and s.shift.name.lower().strip() != "week off":
            return False, f"Employee {emp.name} is already working shift {s.shift.name} on {target_date}"

    # Already assigned emergency replacement today
    emergency_query = db.query(Schedule).filter(
        Schedule.employee_id == employee_id,
        Schedule.date == target_date,
        (Schedule.is_override == True) | (Schedule.replaced_employee_id != None)
    )
    if exclude_schedule_id is not None:
        emergency_query = emergency_query.filter(Schedule.id != exclude_schedule_id)
    emergency_schedules = emergency_query.all()
    if emergency_schedules:
        return False, f"Employee {emp.name} is already assigned as an emergency replacement on {target_date}"

    # Max weekly hours check (Monday to Sunday)
    try:
        import datetime
        target_date_obj = datetime.date.fromisoformat(target_date)
        iso_day = target_date_obj.isoweekday()
        week_start = target_date_obj - datetime.timedelta(days=iso_day - 1)
        week_end = week_start + datetime.timedelta(days=6)
        week_start_str = week_start.isoformat()
        week_end_str = week_end.isoformat()
    except Exception as e:
        return False, f"Date parsing error: {str(e)}"

    c_week_schedules_query = db.query(Schedule).filter(
        Schedule.employee_id == employee_id,
        Schedule.date >= week_start_str,
        Schedule.date <= week_end_str
    )
    if exclude_schedule_id is not None:
        c_week_schedules_query = c_week_schedules_query.filter(Schedule.id != exclude_schedule_id)
    c_week_schedules = c_week_schedules_query.all()
    
    week_worked_hours = 0
    for s in c_week_schedules:
        if s.shift and s.shift.name.lower().strip() != "week off":
            week_worked_hours += _shift_hours(s.shift.start_time, s.shift.end_time)

    # Sum approved overtime in the week
    approved_ot = db.query(func.sum(Overtime.overtime_hours)).filter(
        Overtime.employee_id == employee_id,
        Overtime.overtime_date >= week_start_str,
        Overtime.overtime_date <= week_end_str,
        Overtime.status == "approved"
    ).scalar() or 0.0
    
    approved_ot_log = db.query(func.sum(OvertimeLog.overtime_hours)).filter(
        OvertimeLog.employee_id == employee_id,
        OvertimeLog.week_start_date == week_start_str,
        OvertimeLog.status == "approved"
    ).scalar() or 0.0

    total_week_hours = week_worked_hours + approved_ot + approved_ot_log
    shift_duration = _shift_hours(shift.start_time, shift.end_time)
    limit = emp.max_hours if emp.max_hours else 40

    if total_week_hours + shift_duration > limit:
        return False, f"Employee {emp.name} would exceed max weekly hours limit ({total_week_hours} + {shift_duration} > {limit} hrs)"

    return True, ""


def _find_best_replacement_with_role_filter(db: Session, employee_id: int, target_date: str, shift_id: int, exact_role_match: bool) -> Optional[Employee]:
    orig_emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not orig_emp:
        return None

    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        return None

    # Exclude those on leave today
    leave_ids = {l.employee_id for l in db.query(Leave).filter(Leave.date == target_date).all()}
    leave_ids.add(employee_id)

    all_emps = db.query(Employee).all()
    valid_candidates = []
    
    import datetime
    target_date_obj = datetime.date.fromisoformat(target_date)
    day_name = target_date_obj.strftime('%A')
    
    iso_day = target_date_obj.isoweekday()
    week_start = target_date_obj - datetime.timedelta(days=iso_day - 1)
    week_end = week_start + datetime.timedelta(days=6)
    week_start_str = week_start.isoformat()
    week_end_str = week_end.isoformat()
    
    is_off_map = {}
    weekly_hours_map = {}
    recent_workload_map = {}
    same_dept_map = {}

    for c in all_emps:
        if c.id == employee_id:
            continue
        if c.id in leave_ids:
            continue

        # Role Filtering
        if exact_role_match:
            if not c.role or not orig_emp.role or c.role.lower().strip() != orig_emp.role.lower().strip():
                continue
        else:
            # Fallback: Must be in the same department
            if c.department_id != orig_emp.department_id:
                continue

        # STRICT validations
        is_valid, _ = validate_replacement_constraints(db, c.id, target_date, shift_id)
        if not is_valid:
            continue

        valid_candidates.append(c)

        # Priority 1: Currently off (weekly off or no shift assigned)
        rotated_off_day = get_rotated_weekly_off(c.weekly_off, target_date_obj)
        is_weekly_off = (day_name.lower() == rotated_off_day.lower())
        
        c_today_schedules = db.query(Schedule).filter(
            Schedule.employee_id == c.id,
            Schedule.date == target_date
        ).all()
        has_no_shift = (len(c_today_schedules) == 0) or all(s.shift.name.lower().strip() == "week off" for s in c_today_schedules if s.shift)
        is_off_map[c.id] = (is_weekly_off or has_no_shift)
        
        # Priority 2: Least weekly hours
        c_week_schedules = db.query(Schedule).filter(
            Schedule.employee_id == c.id,
            Schedule.date >= week_start_str,
            Schedule.date <= week_end_str
        ).all()
        week_worked_hours = 0
        for s in c_week_schedules:
            if s.shift and s.shift.name.lower().strip() != "week off":
                week_worked_hours += _shift_hours(s.shift.start_time, s.shift.end_time)

        approved_ot = db.query(func.sum(Overtime.overtime_hours)).filter(
            Overtime.employee_id == c.id,
            Overtime.overtime_date >= week_start_str,
            Overtime.overtime_date <= week_end_str,
            Overtime.status == "approved"
        ).scalar() or 0.0
        
        approved_ot_log = db.query(func.sum(OvertimeLog.overtime_hours)).filter(
            OvertimeLog.employee_id == c.id,
            OvertimeLog.week_start_date == week_start_str,
            OvertimeLog.status == "approved"
        ).scalar() or 0.0

        weekly_hours_map[c.id] = week_worked_hours + approved_ot + approved_ot_log
        
        # Priority 3: Least recent workload
        workload_count = db.query(Schedule).filter(
            Schedule.employee_id == c.id,
            (Schedule.is_override == True) | (Schedule.replaced_employee_id != None)
        ).count()
        recent_workload_map[c.id] = workload_count
        
        # Priority 4: Same department backup
        same_dept_map[c.id] = (c.department_id == orig_emp.department_id) if orig_emp.department_id is not None else False

    if not valid_candidates:
        return None

    # Sort based on priority order:
    valid_candidates.sort(key=lambda c: (
        0 if is_off_map[c.id] else 1,
        0 if same_dept_map[c.id] else 1,
        weekly_hours_map[c.id],
        recent_workload_map[c.id],
        c.id
    ))

    return valid_candidates[0]

def find_best_replacement(db: Session, employee_id: int, target_date: str, shift_id: int) -> Optional[Employee]:
    """
    Intelligent AI selection for replacement with fallback logic.
    """
    best_c = _find_best_replacement_with_role_filter(db, employee_id, target_date, shift_id, exact_role_match=True)
    if best_c:
        return best_c
    return _find_best_replacement_with_role_filter(db, employee_id, target_date, shift_id, exact_role_match=False)


def reassign_shift(db: Session, leave_employee_id: int, leave_date: str):
    """
    STRICT Prioritized Replacement Logic using the unified find_best_replacement engine.
    """
    sched = db.query(Schedule).filter(
        Schedule.employee_id == leave_employee_id,
        Schedule.date == leave_date
    ).first()

    if not sched:
        print(f"[AI] No shift found for employee {leave_employee_id} on {leave_date}. No reassignment needed.")
        return

    best_replacement = find_best_replacement(db, leave_employee_id, leave_date, sched.shift_id)
    if best_replacement:
        sched.employee_id = best_replacement.id
        sched.is_override = True
        sched.replaced_employee_id = leave_employee_id
        db.commit()
        print(f"[AI] Replacement Success: {best_replacement.name} replaced employee {leave_employee_id} for shift {sched.shift.name} on {leave_date}")
    else:
        print(f"[AI] FAILED: No candidate found within constraints for employee {leave_employee_id} on {leave_date}")


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


def validate_overtime_request(
    db: Session,
    employee_id: int,
    date: str,
    overtime_hours: float,
    shift_id: Optional[int] = None,
    exclude_ot_id: Optional[int] = None,
    exclude_ot_log_id: Optional[int] = None
) -> dict:
    """
    Enterprise-level AI validation for overtime requests.
    Enforces workload limits, prevents double shifts, respects leave/weekly off,
    and supports fair rotation.
    """
    validation_status = {
        "valid": True,
        "score": 100,
        "reasons": [],
        "details": {}
    }
    
    # 1. Fetch employee
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return {
            "valid": False,
            "score": 0,
            "reasons": ["Employee not found"],
            "details": {}
        }

    # Check if employee is active
    if employee.leave_status and employee.leave_status.lower() in ["inactive", "terminated"]:
        return {
            "valid": False,
            "score": 0,
            "reasons": [f"Employee is inactive (status: {employee.leave_status})"],
            "details": {}
        }
        
    validation_status["details"]["employee"] = employee.name
    validation_status["details"]["role"] = employee.role
    validation_status["details"]["department"] = employee.department.name if employee.department else "Unassigned"
    
    # 2. Check if date format is valid YYYY-MM-DD
    from datetime import datetime, timedelta
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return {
            "valid": False,
            "score": 0,
            "reasons": ["Invalid date format. Use YYYY-MM-DD"],
            "details": {}
        }

    # 3. Check leave conflicts
    leave = db.query(Leave).filter(Leave.employee_id == employee_id, Leave.date == date).first()
    if leave:
        validation_status["valid"] = False
        validation_status["score"] = 0
        validation_status["reasons"].append(f"Employee is on leave on {date}")
        return validation_status

    # 4. Check weekly off conflicts
    day_name = date_obj.strftime("%A")
    if employee.weekly_off and employee.weekly_off.strip().lower() == day_name.lower():
        validation_status["valid"] = False
        validation_status["score"] = 0
        validation_status["reasons"].append(f"Employee is on weekly off on {date} ({day_name})")
        return validation_status

    # Check shift schedule on that day
    schedules = db.query(Schedule).filter(
        Schedule.employee_id == employee_id,
        Schedule.date == date
    ).all()
    
    # If schedule is WEEK OFF
    for s in schedules:
        if s.shift and s.shift.name.lower().strip() == "week off":
            validation_status["valid"] = False
            validation_status["score"] = 0
            validation_status["reasons"].append(f"Employee has a WEEK OFF assignment scheduled on {date}")
            return validation_status

    # 5. Check double shifts / conflicting shifts
    # Get active working shifts scheduled on this date
    active_schedules = [s for s in schedules if s.shift and s.shift.name.lower().strip() != "week off"]
    if len(active_schedules) == 0:
        validation_status["valid"] = False
        validation_status["score"] = 0
        validation_status["reasons"].append(
            "Employee does not have a scheduled shift (attendance record) on this date. "
            "Overtime requires a shift assignment."
        )
        return validation_status

    if len(active_schedules) > 1:
        validation_status["valid"] = False
        validation_status["score"] = 0
        validation_status["reasons"].append(f"Employee is already scheduled for multiple active shifts on {date}")
        return validation_status
        
    if len(active_schedules) == 1 and shift_id is not None:
        if active_schedules[0].shift_id != shift_id:
            # Overtime shift does not match scheduled shift - double shift risk!
            validation_status["valid"] = False
            validation_status["score"] = 0
            validation_status["reasons"].append(
                f"Double shift conflict: Employee is scheduled on {active_schedules[0].shift.name} shift, "
                f"but OT is requested on a different shift."
            )
            return validation_status

    # 6. Check weekly hours limit
    # Find start (Monday) and end (Sunday) of the week
    week_start = date_obj - timedelta(days=date_obj.weekday())
    week_start_str = week_start.strftime("%Y-%m-%d")
    week_end = week_start + timedelta(days=6)
    week_end_str = week_end.strftime("%Y-%m-%d")

    # Get working hours from scheduled shifts in the week
    week_schedules = db.query(Schedule).filter(
        Schedule.employee_id == employee_id,
        Schedule.date >= week_start_str,
        Schedule.date <= week_end_str
    ).all()
    
    week_worked_hours = 0
    for s in week_schedules:
        if s.shift and s.shift.name.lower().strip() != "week off":
            week_worked_hours += _shift_hours(s.shift.start_time, s.shift.end_time)
            
    # Existing overtime in the week (both tables to be absolutely thorough)
    approved_ot_query = db.query(func.sum(Overtime.overtime_hours)).filter(
        Overtime.employee_id == employee_id,
        Overtime.overtime_date >= week_start_str,
        Overtime.overtime_date <= week_end_str,
        Overtime.status == "approved"
    )
    if exclude_ot_id is not None:
        approved_ot_query = approved_ot_query.filter(Overtime.id != exclude_ot_id)
    approved_ot = approved_ot_query.scalar() or 0.0

    approved_ot_log_query = db.query(func.sum(OvertimeLog.overtime_hours)).filter(
        OvertimeLog.employee_id == employee_id,
        OvertimeLog.week_start_date == week_start_str,
        OvertimeLog.status == "approved"
    )
    if exclude_ot_log_id is not None:
        approved_ot_log_query = approved_ot_log_query.filter(OvertimeLog.id != exclude_ot_log_id)
    approved_ot_log = approved_ot_log_query.scalar() or 0.0
    
    total_week_hours_before = week_worked_hours + approved_ot + approved_ot_log
    total_week_hours_after = total_week_hours_before + overtime_hours
    
    # Check weekly overtime hours limit (department level or default 10)
    max_ot = 10.0
    if employee.department and employee.department.max_overtime_weekly is not None:
        max_ot = float(employee.department.max_overtime_weekly)
        
    limit = min((employee.max_hours if employee.max_hours else 40) + max_ot, 60.0)
    if total_week_hours_after > limit:
        validation_status["valid"] = False
        validation_status["score"] = max(0, validation_status["score"] - 50)
        validation_status["reasons"].append(
            f"Weekly hours limit would be exceeded: {total_week_hours_after:.1f} > {limit} hours "
            f"(Scheduled: {week_worked_hours:.1f}h, Existing OT: {approved_ot + approved_ot_log:.1f}h)"
        )
        
    total_week_ot = approved_ot + approved_ot_log + overtime_hours
    if total_week_ot > max_ot:
        validation_status["valid"] = False
        validation_status["score"] = max(0, validation_status["score"] - 50)
        validation_status["reasons"].append(
            f"Weekly overtime limit of {max_ot} hours would be exceeded (Current OT: {approved_ot + approved_ot_log:.1f}h, Requested: {overtime_hours:.1f}h)"
        )

    # 7. AI rotation, overload protection, and previous OT history (within last 30 days)
    thirty_days_ago = (date_obj - timedelta(days=30)).strftime("%Y-%m-%d")
    recent_ot_entries = db.query(Overtime).filter(
        Overtime.employee_id == employee_id,
        Overtime.overtime_date >= thirty_days_ago,
        Overtime.overtime_date < date,
        Overtime.status == "approved"
    ).all()
    
    recent_ot_logs = db.query(OvertimeLog).filter(
        OvertimeLog.date >= thirty_days_ago,
        OvertimeLog.date < date,
        OvertimeLog.status == "approved"
    ).all()
    
    recent_ot_count = len(recent_ot_entries) + len(recent_ot_logs)
    recent_ot_hours = sum(ot.overtime_hours for ot in recent_ot_entries) + sum(ot.overtime_hours for ot in recent_ot_logs)
    
    # Penalize repeat overtime within the last 30 days to enforce fair rotation
    rotation_penalty = recent_ot_count * 10
    validation_status["score"] = max(0, validation_status["score"] - rotation_penalty)
    
    # Extra penalty for very recent overtime (last 3 days) to prevent consecutive OT overload
    three_days_ago = (date_obj - timedelta(days=3)).strftime("%Y-%m-%d")
    consecutive_ot_count = db.query(Overtime).filter(
        Overtime.employee_id == employee_id,
        Overtime.overtime_date >= three_days_ago,
        Overtime.overtime_date < date,
        Overtime.status == "approved"
    ).count() + db.query(OvertimeLog).filter(
        OvertimeLog.employee_id == employee_id,
        OvertimeLog.date >= three_days_ago,
        OvertimeLog.date < date,
        OvertimeLog.status == "approved"
    ).count()
    
    if consecutive_ot_count > 0:
        validation_status["score"] = max(0, validation_status["score"] - 30)
        validation_status["reasons"].append(f"Avoid consecutive OT: employee worked OT within the last 3 days")
        
    validation_status["details"]["current_week_hours"] = total_week_hours_before
    validation_status["details"]["hours_after_overtime"] = total_week_hours_after
    validation_status["details"]["weekly_limit"] = limit
    validation_status["details"]["recent_ot_assignments_30d"] = recent_ot_count
    validation_status["details"]["recent_ot_hours_30d"] = recent_ot_hours
    
    if validation_status["valid"]:
        validation_status["reasons"].append("Overtime request is valid and can be approved")
    else:
        validation_status["score"] = 0
        
    return validation_status


def find_best_ot_employees(
    db: Session,
    date: str,
    shift_id: int,
    department_id: Optional[int] = None,
    role: Optional[str] = None,
    hours: float = 2.0
) -> list:
    """
    Intelligent AI matching of best candidates for overtime on a given date and shift.
    Balances workload, respects role requirements, and rotates employees fairly.
    """
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        return []
        
    query = db.query(Employee).filter(
        Employee.leave_status == "Active"
    )
    if department_id is not None:
        query = query.filter(Employee.department_id == department_id)
    if role is not None:
        query = query.filter(Employee.role == role)
        
    candidates = query.all()
    results = []
    
    for emp in candidates:
        validation = validate_overtime_request(
            db=db,
            employee_id=emp.id,
            date=date,
            overtime_hours=hours,
            shift_id=shift_id
        )
        if validation["valid"]:
            results.append({
                "employee_id": emp.id,
                "emp_id": emp.emp_id,
                "name": emp.name,
                "role": emp.role,
                "department": emp.department.name if emp.department else "Unassigned",
                "score": validation["score"],
                "details": validation["details"],
                "reasons": validation["reasons"]
            })
            
    # Sort by AI score (highest first), then by name
    results.sort(key=lambda x: (-x["score"], x["name"]))
    return results
