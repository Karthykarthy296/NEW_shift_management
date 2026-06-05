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


departments_router = APIRouter(tags=["Departments"], dependencies=[Depends(get_current_user)])

@departments_router.post("/departments")
def create_department(data: schemas.DepartmentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["admin"]))):
    existing = db.query(Department).filter(Department.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department code already exists")
    
    department = Department(**data.dict())
    db.add(department)
    db.commit()
    db.refresh(department)
    
    return {"msg": "Department created successfully", "department_id": department.id}


@departments_router.get("/departments")
def get_departments(db: Session = Depends(get_db), current_user: User = Depends(require_role(["admin", "manager", "supervisor"]))):
    departments = db.query(Department).all()
    return departments

