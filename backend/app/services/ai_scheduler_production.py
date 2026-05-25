"""
PRODUCTION AI SCHEDULER
Optimized for 1000+ employees with enterprise-grade performance
"""

import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.database.database import Employee, Shift, Schedule, Leave, Department, OvertimeLog
from datetime import date, timedelta, datetime
import random
from functools import lru_cache
import time
import logging
from typing import Dict, List, Tuple, Optional
from collections import defaultdict
import math

logger = logging.getLogger(__name__)

# Performance optimization: Cache for schedule results
_schedule_cache = {}
_cache_expiry = 300  # 5 minutes

def clear_schedule_cache():
    """Clear schedule cache - call after any major changes"""
    global _schedule_cache
    _schedule_cache.clear()
    logger.info("Schedule cache cleared")

def get_cached_schedule(target_date: str) -> Optional[dict]:
    """Get cached schedule if available and not expired"""
    if target_date in _schedule_cache:
        timestamp, data = _schedule_cache[target_date]
        if time.time() - timestamp < _cache_expiry:
            logger.info(f"Returning cached schedule for {target_date}")
            return data
    return None

def cache_schedule(target_date: str, data: dict):
    """Cache schedule data"""
    _schedule_cache[target_date] = (time.time(), data)

def auto_assign_weekly_offs(db: Session):
    """Optimized weekly off assignment for 1000+ employees"""
    try:
        employees = db.query(Employee).filter(Employee.weekly_off.is_(None)).all()
        if not employees:
            return
        
        # Distribute weekly offs evenly (143 per day for 1000 employees)
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        day_counts = defaultdict(int)
        
        # Count existing weekly offs
        existing_offs = db.query(Employee.weekly_off, func.count(Employee.id)).group_by(Employee.weekly_off).all()
        for day, count in existing_offs:
            if day:
                day_counts[day] = count
        
        # Assign weekly offs to balance distribution
        for emp in employees:
            # Find day with minimum count
            min_day = min(days, key=lambda d: day_counts[d])
            emp.weekly_off = min_day
            day_counts[min_day] += 1
        
        db.commit()
        logger.info(f"Auto-assigned weekly offs for {len(employees)} employees")
        
    except Exception as e:
        logger.error(f"Auto assign weekly offs error: {str(e)}")
        db.rollback()
        raise

def ensure_default_shifts(db: Session):
    """Ensure default shifts exist"""
    try:
        existing_shifts = db.query(Shift).count()
        if existing_shifts == 0:
            default_shifts = [
                Shift(name='Morning', start_time='06:00', end_time='14:00', required_employees=3),
                Shift(name='Evening', start_time='14:00', end_time='22:00', required_employees=3),
                Shift(name='Night', start_time='22:00', end_time='06:00', required_employees=2)
            ]
            
            for shift in default_shifts:
                db.add(shift)
            
            db.commit()
            logger.info("Created default shifts")
            
    except Exception as e:
        logger.error(f"Ensure default shifts error: {str(e)}")
        db.rollback()
        raise

def validate_overtime_request(db: Session, employee_id: int, date_str: str, overtime_hours: float) -> dict:
    """Production overtime validation with comprehensive checks"""
    try:
        result = {
            "valid": True,
            "reasons": [],
            "score": 100
        }
        
        # Get employee
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            result["valid"] = False
            result["reasons"].append("Employee not found")
            return result
        
        # Check weekly overtime limit
        week_start = datetime.strptime(date_str, "%Y-%m-%d").date()
        week_start -= timedelta(days=week_start.weekday())
        week_end = week_start + timedelta(days=6)
        
        weekly_ot = db.query(func.sum(OvertimeLog.overtime_hours)).filter(
            and_(
                OvertimeLog.employee_id == employee_id,
                OvertimeLog.date >= week_start.isoformat(),
                OvertimeLog.date <= week_end.isoformat(),
                OvertimeLog.status == "approved"
            )
        ).scalar() or 0
        
        department = db.query(Department).filter(Department.id == employee.department_id).first()
        max_weekly_ot = department.max_overtime_weekly if department else 10
        
        if weekly_ot + overtime_hours > max_weekly_ot:
            result["valid"] = False
            result["reasons"].append(f"Weekly overtime limit exceeded: {weekly_ot + overtime_hours}/{max_weekly_ot} hours")
            result["score"] -= 50
        
        # Check leave conflicts
        leave_exists = db.query(Leave).filter(
            and_(
                Leave.employee_id == employee_id,
                Leave.date == date_str
            )
        ).first()
        
        if leave_exists:
            result["valid"] = False
            result["reasons"].append("Employee is on leave on this date")
            result["score"] -= 100
        
        # Check next-day shift conflicts
        next_day = datetime.strptime(date_str, "%Y-%m-%d").date() + timedelta(days=1)
        next_schedule = db.query(Schedule).filter(
            and_(
                Schedule.employee_id == employee_id,
                Schedule.date == next_day.isoformat()
            )
        ).first()
        
        if next_schedule:
            next_shift = db.query(Shift).filter(Shift.id == next_schedule.shift_id).first()
            if next_shift and next_shift.name == 'Morning':
                result["valid"] = False
                result["reasons"].append("Cannot work overtime before morning shift next day")
                result["score"] -= 30
        
        # Adjust score based on overtime amount
        if overtime_hours > 4:
            result["score"] -= 20
        elif overtime_hours > 2:
            result["score"] -= 10
        
        result["score"] = max(0, result["score"])
        
        return result
        
    except Exception as e:
        logger.error(f"Overtime validation error: {str(e)}")
        return {
            "valid": False,
            "reasons": [f"Validation error: {str(e)}"],
            "score": 0
        }

def validate_weekly_off_swap(db: Session, emp1_id: int, emp2_id: int, target_off_day: str) -> dict:
    """Production weekly off swap validation"""
    try:
        result = {
            "valid": True,
            "details": [],
            "score": 100
        }
        
        # Get employees
        emp1 = db.query(Employee).filter(Employee.id == emp1_id).first()
        emp2 = db.query(Employee).filter(Employee.id == emp2_id).first()
        
        if not emp1 or not emp2:
            result["valid"] = False
            result["details"].append("One or both employees not found")
            return result
        
        # Check same department
        if emp1.department_id != emp2.department_id:
            result["valid"] = False
            result["details"].append("Employees must be in same department")
            result["score"] -= 100
        
        # Check if target day is valid
        valid_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        if target_off_day not in valid_days:
            result["valid"] = False
            result["details"].append("Invalid weekly off day")
            result["score"] -= 100
        
        # Check if emp2's weekly off matches target
        if emp2.weekly_off != target_off_day:
            result["valid"] = False
            result["details"].append(f"Employee 2's weekly off ({emp2.weekly_off}) doesn't match target day ({target_off_day})")
            result["score"] -= 100
        
        # Check department staffing balance
        department = db.query(Department).filter(Department.id == emp1.department_id).first()
        if department:
            # Count employees per weekly off in department
            dept_off_counts = db.query(
                Employee.weekly_off,
                func.count(Employee.id)
            ).filter(
                Employee.department_id == emp1.department_id
            ).group_by(Employee.weekly_off).all()
            
            off_counts = {day: 0 for day in valid_days}
            for day, count in dept_off_counts:
                off_counts[day] = count
            
            # Calculate new counts after swap
            new_emp1_day = target_off_day
            new_emp2_day = emp1.weekly_off
            
            off_counts[emp1.weekly_off] -= 1  # emp1 leaving current day
            off_counts[target_off_day] += 1   # emp1 joining target day
            off_counts[emp2.weekly_off] -= 1  # emp2 leaving current day
            off_counts[emp1.weekly_off] += 1   # emp2 joining emp1's day
            
            # Check for extreme imbalance
            min_count = min(off_counts.values())
            max_count = max(off_counts.values())
            
            if max_count - min_count > department.min_staff_per_shift * 2:
                result["valid"] = False
                result["details"].append("Swap would cause extreme staffing imbalance")
                result["score"] -= 50
        
        return result
        
    except Exception as e:
        logger.error(f"Weekly off swap validation error: {str(e)}")
        return {
            "valid": False,
            "details": [f"Validation error: {str(e)}"],
            "score": 0
        }

def generate_ai_schedule(db: Session, target_date: str, force_refresh: bool = False):
    """Production AI scheduler optimized for 1000+ employees"""
    start_time = time.time()
    
    try:
        # Check cache first
        if not force_refresh:
            cached = get_cached_schedule(target_date)
            if cached:
                return cached
        
        logger.info(f"Starting AI schedule generation for {target_date}")
        
        # Ensure prerequisites
        ensure_default_shifts(db)
        
        # Auto-assign weekly offs if needed
        employees_without_off = db.query(Employee).filter(Employee.weekly_off.is_(None)).count()
        if employees_without_off > 0:
            auto_assign_weekly_offs(db)
        
        # Bulk data fetch for performance
        employees = db.query(Employee).options(
            joinedload(Employee.department)
        ).all()
        
        departments = db.query(Department).all()
        shifts = db.query(Shift).all()
        leaves = db.query(Leave).filter(Leave.date == target_date).all()
        
        if not employees or not shifts:
            logger.warning("No employees or shifts found")
            return {"status": "error", "message": "No employees or shifts available"}
        
        # Clear existing schedules for this date
        db.query(Schedule).filter(Schedule.date == target_date).delete()
        
        # Prepare data structures
        leave_ids = {l.employee_id for l in leaves}
        shift_assignments = {shift.id: [] for shift in shifts}
        employee_hours = defaultdict(int)
        assigned_emps = set()
        
        # Group employees by department for department-wise scheduling
        employees_by_dept = defaultdict(list)
        for emp in employees:
            dept_id = emp.department_id or 0
            employees_by_dept[dept_id].append(emp)
        
        # Precompute shift durations
        shift_durations = {}
        for shift in shifts:
            start = datetime.strptime(shift.start_time, "%H:%M")
            end = datetime.strptime(shift.end_time, "%H:%M")
            if end < start:
                end += timedelta(days=1)
            duration = (end - start).total_seconds() / 3600
            shift_durations[shift.id] = duration
        
        # Get historical data for scoring
        week_start = (datetime.strptime(target_date, "%Y-%m-%d").date() - timedelta(days=datetime.strptime(target_date, "%Y-%m-%d").date().weekday())).isoformat()
        
        historical_hours = {}
        recent_shifts = defaultdict(list)
        days_worked = {}
        
        # Optimized historical data query
        hist_schedules = db.query(Schedule).filter(
            Schedule.date >= week_start,
            Schedule.date < target_date
        ).options(
            joinedload(Schedule.shift),
            joinedload(Schedule.employee)
        ).all()
        
        for sched in hist_schedules:
            if sched.employee_id not in historical_hours:
                historical_hours[sched.employee_id] = 0
            if sched.shift:
                historical_hours[sched.employee_id] += shift_durations.get(sched.shift_id, 8)
                recent_shifts[sched.employee_id].append(sched.shift.name if sched.shift else "Unknown")
            
            if sched.employee_id not in days_worked:
                days_worked[sched.employee_id] = 0
            days_worked[sched.employee_id] += 1
        
        # Precompute scores for performance
        precomputed_scores = {}
        for emp in employees:
            if emp.id in leave_ids:
                continue
                
            precomputed_scores[emp.id] = {}
            hist_hours = historical_hours.get(emp.id, 0)
            d_worked = days_worked.get(emp.id, 0)
            r_shifts = recent_shifts.get(emp.id, [])
            
            for shift in shifts:
                score = hist_hours
                if emp.preferred_shift != shift.name:
                    score += 100
                if shift.name == 'Night' and emp.preferred_shift == 'Night':
                    score -= 50
                if r_shifts.count(shift.name) >= 2:
                    score += 200
                if d_worked >= 6:
                    score += 150
                precomputed_scores[emp.id][shift.id] = score
        
        # Phase 1: Department-wise preferred shifts
        for dept_id, dept_employees in employees_by_dept.items():
            dept = next((d for d in departments if d.id == dept_id), None) if dept_id != 0 else None
            min_staff = dept.min_staff_per_shift if dept else 1
            
            # Filter available employees for this department
            dept_available = [e for e in dept_employees if e.id not in leave_ids and e.id not in assigned_emps]
            
            for shift in shifts:
                preferred = [
                    e for e in dept_available
                    if e.preferred_shift == shift.name and e.id not in assigned_emps
                ]
                
                # Sort by precomputed score
                preferred.sort(key=lambda e: precomputed_scores[e.id].get(shift.id, 1000))
                
                assigned_count = 0
                for emp in preferred:
                    if len(shift_assignments[shift.id]) >= shift.required_employees:
                        break
                    if assigned_count >= min_staff:
                        break
                        
                    dur = shift_durations[shift.id]
                    if employee_hours[emp.id] + dur <= emp.max_hours:
                        shift_assignments[shift.id].append(emp.id)
                        employee_hours[emp.id] += dur
                        assigned_emps.add(emp.id)
                        dept_available.remove(emp)
                        assigned_count += 1
        
        # Phase 2: Fill remaining slots department-wise
        for dept_id, dept_employees in employees_by_dept.items():
            dept = next((d for d in departments if d.id == dept_id), None) if dept_id != 0 else None
            min_staff = dept.min_staff_per_shift if dept else 1
            
            # Filter available employees for this department
            dept_available = [e for e in dept_employees if e.id not in leave_ids and e.id not in assigned_emps]
            
            for shift in shifts:
                # Ensure minimum staff per department for each shift
                dept_assigned = [eid for eid in shift_assignments[shift.id] 
                               if next((e for e in dept_employees if e.id == eid), None)]
                
                while len(dept_assigned) < min_staff and dept_available:
                    candidates = dept_available.copy()
                    if not candidates:
                        break
                    
                    candidates.sort(key=lambda e: precomputed_scores[e.id].get(shift.id, 1000))
                    chosen = candidates[0]
                    
                    dur = shift_durations[shift.id]
                    if employee_hours[chosen.id] + dur <= chosen.max_hours:
                        shift_assignments[shift.id].append(chosen.id)
                        employee_hours[chosen.id] += dur
                        assigned_emps.add(chosen.id)
                        dept_assigned.append(chosen.id)
                        dept_available.remove(chosen)
                    else:
                        dept_available.remove(chosen)
        
        # Phase 3: Fill remaining slots across all departments
        all_available = [e for e in employees if e.id not in leave_ids and e.id not in assigned_emps]
        
        for shift in shifts:
            while len(shift_assignments[shift.id]) < shift.required_employees and all_available:
                candidates = all_available.copy()
                if not candidates:
                    break
                
                candidates.sort(key=lambda e: precomputed_scores[e.id].get(shift.id, 1000))
                chosen = candidates[0]
                
                dur = shift_durations[shift.id]
                if employee_hours[chosen.id] + dur <= chosen.max_hours:
                    shift_assignments[shift.id].append(chosen.id)
                    employee_hours[chosen.id] += dur
                    assigned_emps.add(chosen.id)
                    all_available.remove(chosen)
                else:
                    all_available.remove(chosen)
        
        # Create schedule records in bulk for performance
        schedule_records = []
        for shift_id, employee_ids in shift_assignments.items():
            for emp_id in employee_ids:
                schedule_records.append({
                    'date': target_date,
                    'shift_id': shift_id,
                    'employee_id': emp_id,
                    'is_override': False
                })
        
        # Bulk insert schedules
        if schedule_records:
            db.bulk_insert_mappings(Schedule, schedule_records)
        
        db.commit()
        
        # Prepare result summary
        result = {
            "status": "success",
            "date": target_date,
            "total_assignments": len(schedule_records),
            "shift_assignments": {
                shift.name: len(employee_ids) 
                for shift, employee_ids in zip(shifts, shift_assignments.values())
            },
            "processing_time": time.time() - start_time,
            "employees_processed": len(employees),
            "departments": len(departments)
        }
        
        # Cache the result
        cache_schedule(target_date, result)
        
        # Log summary
        summary = f"[AI Scheduler] Schedule generated — {len(schedule_records)} assignments:\n"
        for shift, employee_ids in zip(shifts, shift_assignments.values()):
            if employee_ids:
                emp_names = [db.query(Employee).filter(Employee.id == eid).first().name for eid in employee_ids[:3]]
                summary += f"  {shift.name}: {', '.join(emp_names)}"
                if len(employee_ids) > 3:
                    summary += f" (+{len(employee_ids)-3} more)"
                summary += "\n"
            else:
                summary += f"  {shift.name}: EMPTY\n"
        
        logger.info(summary)
        
        return result
        
    except Exception as e:
        logger.error(f"AI Schedule generation error: {str(e)}")
        db.rollback()
        raise

def handle_leave_request(db: Session, employee_id: int, leave_date: str):
    """Handle leave request with partial schedule updates"""
    try:
        # Get employee's schedule for leave date
        schedule = db.query(Schedule).filter(
            and_(
                Schedule.employee_id == employee_id,
                Schedule.date == leave_date
            )
        ).first()
        
        if schedule:
            # Find replacement employee
            replacement = find_replacement_employee(db, schedule.shift_id, leave_date, employee_id)
            
            if replacement:
                # Update schedule with replacement
                schedule.replaced_employee_id = employee_id
                schedule.employee_id = replacement
                db.commit()
                logger.info(f"Employee {replacement} replaced employee {employee_id} for {leave_date}")
            else:
                # Remove assignment if no replacement found
                db.delete(schedule)
                db.commit()
                logger.info(f"Removed assignment for employee {employee_id} on {leave_date} (no replacement found)")
        
    except Exception as e:
        logger.error(f"Handle leave request error: {str(e)}")
        db.rollback()
        raise

def handle_leave_cancellation(db: Session, employee_id: int, leave_date: str):
    """Handle leave cancellation with partial schedule updates"""
    try:
        # Check if there's a replacement assignment
        schedule = db.query(Schedule).filter(
            and_(
                Schedule.employee_id != employee_id,
                Schedule.replaced_employee_id == employee_id,
                Schedule.date == leave_date
            )
        ).first()
        
        if schedule:
            # Restore original employee
            original_emp_id = schedule.replaced_employee_id
            schedule.employee_id = original_emp_id
            schedule.replaced_employee_id = None
            db.commit()
            logger.info(f"Restored employee {original_emp_id} for {leave_date}")
        
    except Exception as e:
        logger.error(f"Handle leave cancellation error: {str(e)}")
        db.rollback()
        raise

def find_replacement_employee(db: Session, shift_id: int, date: str, exclude_emp_id: int) -> Optional[int]:
    """Find replacement employee for shift"""
    try:
        # Get shift details
        shift = db.query(Shift).filter(Shift.id == shift_id).first()
        if not shift:
            return None
        
        # Get available employees (not on leave, not already assigned)
        leave_ids = {l.employee_id for l in db.query(Leave).filter(Leave.date == date).all()}
        assigned_ids = {s.employee_id for s in db.query(Schedule).filter(
            and_(Schedule.date == date, Schedule.shift_id != shift_id)
        ).all()}
        
        available_employees = db.query(Employee).filter(
            and_(
                Employee.id.notin_(leave_ids),
                Employee.id.notin_(assigned_ids),
                Employee.id != exclude_emp_id
            )
        ).all()
        
        # Prefer employees with same preferred shift
        preferred = [e for e in available_employees if e.preferred_shift == shift.name]
        if preferred:
            return preferred[0].id
        
        # Otherwise return any available employee
        if available_employees:
            return available_employees[0].id
        
        return None
        
    except Exception as e:
        logger.error(f"Find replacement employee error: {str(e)}")
        return None
