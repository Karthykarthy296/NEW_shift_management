from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database.database import SessionLocal, User, Overtime
from app.middleware import auth
from app.utils.activity_logger import log_activity
from app.services.overtime_service import OvertimeService
from app.models.schemas import OvertimeCreate, OvertimeUpdate
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

router = APIRouter(prefix="/overtime", tags=["Overtime Management"])

@router.post("/add", status_code=status.HTTP_201_CREATED)
async def add_overtime(
    payload: OvertimeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager"]))
):
    try:
        ot = OvertimeService.add_overtime(
            db=db,
            employee_id=payload.employee_id,
            overtime_hours=payload.overtime_hours,
            overtime_date=payload.overtime_date,
            reason=payload.reason,
            shift_name=payload.shift,
            status=payload.status or "pending",
            approved_by_id=current_user.id
        )
        
        await log_activity(
            db=db,
            activity="OT Added",
            module_name="Overtime Management",
            status="success",
            description=f"Overtime of {ot.overtime_hours} hours added for employee {ot.employee_name} on {ot.overtime_date}",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        return {
            "status": "success",
            "message": "Overtime record added successfully",
            "data": ot
        }
    except HTTPException as he:
        await log_activity(
            db=db,
            activity="OT Added",
            module_name="Overtime Management",
            status="failed",
            description=f"Failed to add overtime for employee ID {payload.employee_id}: {he.detail}",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        raise he
    except Exception as e:
        await log_activity(
            db=db,
            activity="OT Added",
            module_name="Overtime Management",
            status="failed",
            description=f"System error adding overtime: {str(e)}",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recommend", response_model=List[dict])
def recommend_ot_employees(
    date: str,
    shift_id: int,
    department_id: Optional[int] = Query(None),
    role: Optional[str] = Query(None),
    hours: float = Query(2.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager", "supervisor"]))
):
    try:
        recommendations = ai_scheduler.find_best_ot_employees(
            db=db,
            date=date,
            shift_id=shift_id,
            department_id=department_id,
            role=role,
            hours=hours
        )
        return recommendations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
def get_overtimes(
    request: Request,
    employee_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    shift: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager", "supervisor"]))
):
    try:
        print("Request received:", request.url)
        print("Current user:", current_user)
        records = OvertimeService.get_overtime_list(
            db=db,
            employee_id=employee_id,
            department=department,
            date=date,
            shift=shift,
            search=search
        )
        print("Overtime records found:", len(records))
        return {
            "status": "success",
            "count": len(records),
            "data": records
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
def get_overtime_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager", "supervisor"]))
):
    try:
        stats = OvertimeService.get_overtime_stats(db=db)
        return {
            "status": "success",
            "data": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id}")
async def update_overtime(
    id: int,
    payload: OvertimeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager"]))
):
    try:
        ot = OvertimeService.update_overtime(
            db=db,
            ot_id=id,
            overtime_hours=payload.overtime_hours,
            overtime_date=payload.overtime_date,
            reason=payload.reason,
            shift_name=payload.shift,
            status=payload.status,
            approved_by_id=current_user.id
        )
        
        await log_activity(
            db=db,
            activity="OT Updated",
            module_name="Overtime Management",
            status="success",
            description=f"Overtime record ID {id} updated for employee {ot.employee_name} (New hours: {ot.overtime_hours}, Status: {ot.status})",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        return {
            "status": "success",
            "message": "Overtime record updated successfully",
            "data": ot
        }
    except HTTPException as he:
        await log_activity(
            db=db,
            activity="OT Updated",
            module_name="Overtime Management",
            status="failed",
            description=f"Failed to update overtime record ID {id}: {he.detail}",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        raise he
    except Exception as e:
        await log_activity(
            db=db,
            activity="OT Updated",
            module_name="Overtime Management",
            status="failed",
            description=f"System error updating overtime record ID {id}: {str(e)}",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{id}")
async def delete_overtime(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager"]))
):
    try:
        # Retrieve name for logging before delete
        ot = db.query(Overtime).filter(Overtime.id == id).first()
        if not ot:
            raise HTTPException(status_code=404, detail="Overtime record not found")
        
        employee_name = ot.employee_name
        ot_date = ot.overtime_date
        ot_hours = ot.overtime_hours
        
        OvertimeService.delete_overtime(db=db, ot_id=id)
        
        await log_activity(
            db=db,
            activity="OT Deleted",
            module_name="Overtime Management",
            status="success",
            description=f"Overtime record ID {id} ({ot_hours} hours for {employee_name} on {ot_date}) deleted successfully",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        return {
            "status": "success",
            "message": "Overtime record deleted successfully"
        }
    except HTTPException as he:
        await log_activity(
            db=db,
            activity="OT Deleted",
            module_name="Overtime Management",
            status="failed",
            description=f"Failed to delete overtime record ID {id}: {he.detail}",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        raise he
    except Exception as e:
        await log_activity(
            db=db,
            activity="OT Deleted",
            module_name="Overtime Management",
            status="failed",
            description=f"System error deleting overtime record ID {id}: {str(e)}",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        raise HTTPException(status_code=500, detail=str(e))
