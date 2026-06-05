from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict
from app.database.database import SessionLocal, User, Employee, Schedule, Leave, WeeklyOffSwap, OvertimeLog, Department, WeeklyShiftChange, Shift, ScheduleGenerationLog, Overtime
from app.models import schemas
from app.middleware import auth
from app.utils.activity_logger import log_activity
from fastapi.security import HTTPAuthorizationCredentials
import datetime
import io
import pandas as pd
from app.services import ai_scheduler

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(auth.security), db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = auth.decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.username == payload["username"]).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def require_role(roles: list):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
        return current_user
    return role_checker

def log_schedule_generation(db: Session, generated_for_date: str, total_assignments: int = 0, trigger_source: str = "manual", user_id: int = None):
    try:
        log = ScheduleGenerationLog(
            generated_for_date=generated_for_date,
            generated_by=user_id,
            trigger_source=trigger_source,
            total_assignments=total_assignments,
        )
        db.add(log)
        db.commit()
    except Exception as e:
        print(f"Warning: could not write schedule generation log: {e}")
        db.rollback()


leaves_router = APIRouter(tags=["Leaves & Time Off"], dependencies=[Depends(get_current_user)])

@leaves_router.get("/leaves")
def get_leaves(date: str = None, db: Session = Depends(get_db), current_user: User = Depends(require_role(["manager", "admin", "supervisor"]))):
    if not date:
        date = datetime.date.today().isoformat()
    leaves = db.query(Leave).filter(Leave.date == date).all()
    res = []
    for l in leaves:
        res.append({
            "id": l.id,
            "employee_name": l.employee.name,
            "employee_id": l.employee.emp_id,
            "date": l.date
        })
    return res


@leaves_router.get("/weekly-off")
def get_weekly_off(date: str = None, db: Session = Depends(get_db)):
    """
    Get weekly off employees for a specific date or today
    """
    try:
        print("=== GET WEEKLY OFF API CALLED ===")
        
        if not date:
            date = datetime.date.today().isoformat()
        
        # Get day name for the date
        date_obj = datetime.datetime.strptime(date, '%Y-%m-%d').date()
        day_name = date_obj.strftime('%A')
        
        # Get employees on weekly off
        weekly_off_employees = db.query(Employee).filter(Employee.weekly_off == day_name).all()
        
        weekly_off_list = []
        for emp in weekly_off_employees:
            emp_data = {
                "id": emp.id,
                "emp_id": emp.emp_id,
                "name": emp.name,
                "department": emp.department.name if emp.department else "Unknown",
                "weekly_off": emp.weekly_off,
                "preferred_shift": emp.preferred_shift or "Not Assigned"
            }
            weekly_off_list.append(emp_data)
        
        print(f"[PASS] Weekly off loaded: {len(weekly_off_list)} employees for {day_name}")
        
        return {
            "status": "success",
            "weekly_off_employees": weekly_off_list,
            "total_count": len(weekly_off_list),
            "date": date,
            "day_name": day_name
        }
        
    except Exception as e:
        print(f"[FAIL] Error getting weekly off: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting weekly off: {str(e)}"
        )


@leaves_router.post("/auto-assign-weekly-offs")
async def auto_assign_weekly_offs(db: Session = Depends(get_db), current_user: User = Depends(require_role(["manager", "admin"]))):
    try:
        print("\n" + "="*60)
        print("AUTO-ASSIGN WEEKLY OFFS STARTED")
        print("="*60)
        
        ai_scheduler.auto_assign_weekly_offs(db)
        print("[OK] Weekly offs assigned")
        
        ai_scheduler.clear_schedule_cache()
        print("[OK] Cache cleared")
        
        # Regenerate today's schedule to reflect new weekly offs
        today = datetime.date.today().isoformat()
        print(f"[BOT] Regenerating schedule for {today}...")
        
        ai_scheduler.generate_ai_schedule(db, today, force_refresh=True)
        print("[OK] Schedule regenerated")
        
        # Log this generation (triggered by auto-assign)
        log_schedule_generation(db, today, trigger_source="auto-assign")
        
        print("="*60)
        print("AUTO-ASSIGN COMPLETE")
        print("="*60 + "\n")
        
        return {"msg": "AI has successfully distributed weekly offs for all employees and updated the schedule."}
    except Exception as e:
        print(f"\n[ERR] ERROR in auto-assign-weekly-offs: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error auto-assigning weekly offs: {str(e)}")


@leaves_router.post("/apply-leave")
async def apply_leave(leave: schemas.LeaveApply, db: Session = Depends(get_db), current_user: User = Depends(require_role(["supervisor", "manager", "admin"]))):
    emp = db.query(Employee).filter(Employee.name == leave.employee_name).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if a leave record already exists for today to avoid duplicate entries
    existing_leave = db.query(Leave).filter(Leave.employee_id == emp.id, Leave.date == leave.date).first()
    if not existing_leave:
        new_leave = Leave(employee_id=emp.id, date=leave.date)
        db.add(new_leave)
        db.commit()
    
    # Clear cache
    ai_scheduler.clear_schedule_cache()
    
    # Fetch sorted list of eligible replacement candidates
    candidates = ai_scheduler.get_replacement_candidates_list(db, emp.id, leave.date)
    
    await log_activity(
        db=db,
        activity="Leave Applied",
        module_name="Leave Management",
        status="success",
        description=f"Leave applied for {emp.name} on {leave.date}.",
        user_id=current_user.id,
        username=current_user.username,
        role=current_user.role
    )
    
    return {
        "msg": f"Leave applied for {emp.name} on {leave.date}.",
        "candidates": candidates
    }


@leaves_router.get("/leaves/replacement-candidates")
def get_replacement_candidates(date: str, employee_id: int = None, employee_name: str = None, db: Session = Depends(get_db), current_user: User = Depends(require_role(["supervisor", "manager", "admin"]))):
    if not employee_id and not employee_name:
        raise HTTPException(status_code=400, detail="Either employee_id or employee_name must be provided")
    
    if employee_id:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
    else:
        emp = db.query(Employee).filter(Employee.name == employee_name).first()
        
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    candidates = ai_scheduler.get_replacement_candidates_list(db, emp.id, date)
    return candidates


@leaves_router.post("/leaves/assign-replacement")
async def assign_leave_replacement(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role(["supervisor", "manager", "admin"]))):
    date = payload.get("date")
    employee_id = payload.get("employee_id")
    employee_name = payload.get("employee_name")
    replacement_id = payload.get("replacement_id")
    replacement_name = payload.get("replacement_name")
    
    if not date:
        raise HTTPException(status_code=400, detail="Missing date")
        
    # Resolve leave employee
    if employee_id:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
    elif employee_name:
        emp = db.query(Employee).filter(Employee.name == employee_name).first()
    else:
        raise HTTPException(status_code=400, detail="Missing employee_id or employee_name")
        
    if not emp:
        raise HTTPException(status_code=404, detail="Leave employee not found")
        
    # Resolve replacement employee
    if replacement_id:
        rep = db.query(Employee).filter(Employee.id == replacement_id).first()
    elif replacement_name:
        rep = db.query(Employee).filter(Employee.name == replacement_name).first()
    else:
        raise HTTPException(status_code=400, detail="Missing replacement_id or replacement_name")
        
    if not rep:
        raise HTTPException(status_code=404, detail="Replacement employee not found")
        
    # Find the schedule for the leave employee on that date
    sched = db.query(Schedule).filter(
        Schedule.employee_id == emp.id,
        Schedule.date == date
    ).first()
    
    if not sched:
        # Check if there is already a schedule that was reassigned to someone else (or previously reassigned)
        sched = db.query(Schedule).filter(
            Schedule.replaced_employee_id == emp.id,
            Schedule.date == date
        ).first()
        
    if not sched:
        # If no schedule exists, create a new one for the replacement employee with their preferred shift or fallback to Morning
        preferred_shift_obj = db.query(Shift).filter(Shift.name == emp.preferred_shift).first()
        shift_id = preferred_shift_obj.id if preferred_shift_obj else 2  # Default to Morning
        sched = Schedule(
            employee_id=rep.id,
            date=date,
            shift_id=shift_id,
            is_override=True,
            replaced_employee_id=emp.id
        )
        db.add(sched)
    else:
        # Update the existing schedule to assign it to the replacement
        sched.employee_id = rep.id
        sched.is_override = True
        sched.replaced_employee_id = emp.id
        
    db.commit()
    
    # Clear schedule cache
    ai_scheduler.clear_schedule_cache()
    
    await log_activity(
        db=db,
        activity="Leave Replacement Assigned",
        module_name="Leave Management",
        status="success",
        description=f"Replacement {rep.name} assigned for {emp.name} on {date}",
        user_id=current_user.id,
        username=current_user.username,
        role=current_user.role
    )
    
    return {
        "status": "success",
        "message": f"Successfully assigned {rep.name} as replacement for {emp.name} on {date}."
    }


@leaves_router.delete("/cancel-leave")
async def cancel_leave(employee_name: str, date: str, db: Session = Depends(get_db), current_user: User = Depends(require_role(["supervisor", "manager", "admin"]))):
    emp = db.query(Employee).filter(Employee.name == employee_name).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    leave = db.query(Leave).filter(Leave.employee_id == emp.id, Leave.date == date).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    
    db.delete(leave)
    db.commit()
    
    # Trigger AI to handle leave cancellation and weekly off transfer
    ai_scheduler.handle_leave_cancellation(db, emp.id, date)
    
    await log_activity(
        db=db,
        activity="Leave Cancelled",
        module_name="Leave Management",
        status="success",
        description=f"Leave cancelled for {emp.name} on {date}.",
        user_id=current_user.id,
        username=current_user.username,
        role=current_user.role
    )
    
    return {"msg": f"Leave cancelled for {emp.name} on {date}. AI handled weekly off transfer."}


@leaves_router.post("/request-weekly-off-swap")
def request_weekly_off_swap(request: schemas.WeeklyOffSwapRequest, db: Session = Depends(get_db), current_user: User = Depends(require_role(["supervisor", "manager", "admin"]))):
    emp1 = db.query(Employee).filter(Employee.name == request.employee_1_name).first()
    emp2 = db.query(Employee).filter(Employee.name == request.employee_2_name).first()
    
    if not emp1 or not emp2:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # AI Validation
    validation_status = ai_scheduler.validate_weekly_off_swap(db, emp1.id, emp2.id, request.target_off_day)
    
    # Create swap request
    new_swap = WeeklyOffSwap(
        employee_1_id=emp1.id,
        employee_2_id=emp2.id,
        old_off_day=emp1.weekly_off,
        new_off_day=request.target_off_day,
        status="pending",
        ai_validation_status=validation_status
    )
    
    db.add(new_swap)
    db.commit()
    db.refresh(new_swap)
    
    return {
        "msg": "Weekly off swap request submitted for approval",
        "swap_id": new_swap.id,
        "ai_validation": validation_status
    }


@leaves_router.get("/weekly-off-swaps")
def get_weekly_off_swaps(status: str = None, db: Session = Depends(get_db), current_user: User = Depends(require_role(["manager", "admin"]))):
    query = db.query(WeeklyOffSwap)
    if status:
        query = query.filter(WeeklyOffSwap.status == status)
    
    swaps = query.order_by(WeeklyOffSwap.created_at.desc()).all()
    
    result = []
    for swap in swaps:
        result.append({
            "id": swap.id,
            "employee_1_name": swap.employee_1.name,
            "employee_2_name": swap.employee_2.name,
            "old_off_day": swap.old_off_day,
            "new_off_day": swap.new_off_day,
            "status": swap.status,
            "ai_validation_status": swap.ai_validation_status,
            "rejection_reason": swap.rejection_reason,
            "created_at": swap.created_at.isoformat() if swap.created_at else None,
            "approved_at": swap.approved_at.isoformat() if swap.approved_at else None,
            "approved_by_name": swap.approver.username if swap.approver else None
        })
    
    return result


@leaves_router.post("/approve-weekly-off-swap")
def approve_weekly_off_swap(approval: schemas.WeeklyOffSwapApproval, db: Session = Depends(get_db), current_user: User = Depends(require_role(["manager", "admin"]))):
    swap = db.query(WeeklyOffSwap).filter(WeeklyOffSwap.id == approval.swap_id).first()
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if swap.status != "pending":
        raise HTTPException(status_code=400, detail="Swap request already processed")
    
    if approval.approve:
        # Check AI validation again before approval
        validation_status = ai_scheduler.validate_weekly_off_swap(db, swap.employee_1_id, swap.employee_2_id, swap.new_off_day)
        
        if not validation_status["valid"]:
            swap.status = "rejected"
            swap.rejection_reason = "AI validation failed: " + "; ".join(validation_status["details"])
            swap.approved_by = current_user.id
            swap.approved_at = datetime.datetime.utcnow()
            db.commit()
            return {
                "msg": "Swap rejected due to AI validation",
                "swap_id": swap.id,
                "reason": swap.rejection_reason
            }
        
        # Update employee weekly offs
        emp1 = db.query(Employee).filter(Employee.id == swap.employee_1_id).first()
        emp2 = db.query(Employee).filter(Employee.id == swap.employee_2_id).first()
        
        # Swap weekly off days
        emp1.weekly_off = swap.new_off_day
        emp2.weekly_off = swap.old_off_day
        
        swap.status = "approved"
        swap.approved_by = current_user.id
        swap.approved_at = datetime.datetime.utcnow()
        
        db.commit()
        
        return {
            "msg": f"Weekly off swap approved: {emp1.name} now has {swap.new_off_day}, {emp2.name} now has {swap.old_off_day}",
            "swap_id": swap.id
        }
    else:
        swap.status = "rejected"
        swap.rejection_reason = approval.rejection_reason or "Rejected by manager"
        swap.approved_by = current_user.id
        swap.approved_at = datetime.datetime.utcnow()
        db.commit()
        
        return {
            "msg": f"Weekly off swap rejected",
            "swap_id": swap.id,
            "reason": swap.rejection_reason
        }


@leaves_router.get("/reports/leave-stats")
def get_leave_stats(db: Session = Depends(get_db)):
    """Returns leave statistics for reports."""
    # Frequent leave takers
    from sqlalchemy import func
    frequent = db.query(Employee.name, Department.name.label("dept"), func.count(Leave.id).label("count"))\
        .join(Leave, Leave.employee_id == Employee.id)\
        .join(Department, Employee.department_id == Department.id)\
        .group_by(Employee.id)\
        .order_by(func.count(Leave.id).desc())\
        .limit(5).all()
    
    return {
        "frequent": [{"name": f.name, "dept": f.dept, "count": f.count} for f in frequent],
        "trends": [
            {"name": "Jan", "medical": 12, "personal": 5, "casual": 8},
            {"name": "Feb", "medical": 15, "personal": 8, "casual": 4},
            {"name": "Mar", "medical": 10, "personal": 12, "casual": 6},
            {"name": "Apr", "medical": 18, "personal": 7, "casual": 10}
        ]
    }


@leaves_router.get("/weekly-off-distribution")
async def get_weekly_off_distribution(db: Session = Depends(get_db)):
    """
    Returns the current weekly off distribution stats for all employees.
    Includes per-day counts, ideal target, balance score, and unassigned count.
    """
    try:
        result = ai_scheduler.get_weekly_off_distribution(db)
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching distribution: {str(e)}")


@leaves_router.post("/assign-weekly-offs")
async def assign_weekly_offs(request: dict = {}, db: Session = Depends(get_db)):
    """
    Runs the enterprise fair weekly off assignment algorithm.
    Uses min-heap balancing to guarantee even distribution across all 7 days.
    
    Body (optional):
      { "force_reassign": true }  — re-assign ALL employees (even those with valid offs)
    """
    try:
        force = bool(request.get("force_reassign", False))
        print(f"[API] /assign-weekly-offs called. force_reassign={force}")
        result = ai_scheduler.auto_assign_weekly_offs(db, force_reassign=force)
        return result
    except Exception as e:
        db.rollback()
        print(f"[FAIL] Error assigning weekly offs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error assigning weekly offs: {str(e)}")


@leaves_router.post("/rotate-weekly-offs")
async def rotate_weekly_offs(request: dict = {}, db: Session = Depends(get_db)):
    """
    Rotates all employee weekly off days forward by N steps for fairness.
    Ensures no employee is permanently stuck on the same off day.
    
    Body (optional):
      { "week_offset": 1 }   — steps forward (default: 1)
    """
    try:
        offset = int(request.get("week_offset", 1))
        if offset < 1 or offset > 6:
            raise HTTPException(status_code=400, detail="week_offset must be between 1 and 6")
        result = ai_scheduler.rotate_weekly_offs_for_week(db, week_offset=offset)
        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error rotating weekly offs: {str(e)}")


@leaves_router.get("/weekly-off-roster")
async def get_weekly_off_roster(
    day: str = None,
    department: str = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db)
):
    """
    Returns paginated roster of employees grouped by their weekly off day.
    Supports filtering by specific day or department.
    """
    try:
        valid_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        query = db.query(Employee)

        if day:
            day = day.strip().capitalize()
            if day not in valid_days:
                raise HTTPException(status_code=400, detail=f"Invalid day: {day}")
            query = query.filter(Employee.weekly_off == day)

        if department:
            from sqlalchemy.orm import aliased
            query = query.join(Department).filter(Department.name.ilike(f"%{department}%"))

        total = query.count()
        employees = query.offset((page - 1) * page_size).limit(page_size).all()

        roster = []
        for emp in employees:
            roster.append({
                "id": emp.id,
                "emp_id": emp.emp_id,
                "name": emp.name,
                "role": emp.role or "Staff",
                "department": emp.department.name if emp.department else "General",
                "weekly_off": emp.weekly_off or "Not Set",
            })

        # Distribution summary
        distribution = {d: 0 for d in valid_days}
        all_emps = db.query(Employee).all()
        for e in all_emps:
            if e.weekly_off in valid_days:
                distribution[e.weekly_off] += 1

        return {
            "status": "success",
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
            "employees": roster,
            "distribution": distribution,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching roster: {str(e)}")

