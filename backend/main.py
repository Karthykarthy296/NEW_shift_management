import sys, io
# Force UTF-8 stdout/stderr on Windows to prevent charmap UnicodeEncodeError
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database.database import engine, SessionLocal, Base, User, Employee, Shift, Schedule, Leave, WeeklyOffSwap, OvertimeLog, Department, ScheduleGenerationLog, WeeklyShiftChange, Overtime
from app.models import schemas
from app.middleware import auth
from app.services import ai_scheduler
import shutil
import os
import datetime
from typing import Optional, List, Dict
from fastapi.security import HTTPAuthorizationCredentials

from app.routes.activity_routes import router as activity_router
from app.routes.overtime_routes import router as overtime_router
from app.middleware.activity_middleware import ActivityLoggingMiddleware
from app.utils.activity_logger import log_activity

Base.metadata.create_all(bind=engine)

# Auto-seed default users if database is empty
def seed_default_users():
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            print("Auto-seeding default credentials...")
            db.add(User(username="admin", name="Admin User", password_hash=auth.get_password_hash("admin123"), role="admin"))
            db.add(User(username="manager", name="Manager User", password_hash=auth.get_password_hash("admin123"), role="manager"))
            db.add(User(username="supervisor", name="Supervisor User", password_hash=auth.get_password_hash("admin123"), role="supervisor"))
            db.commit()
            print("Default credentials successfully seeded.")
    except Exception as e:
        print(f"Warning: Could not seed default users: {e}")
        db.rollback()
    finally:
        db.close()

seed_default_users()

app = FastAPI()

is_generating_schedule = False

@app.middleware("http")
async def add_cors_to_errors(request, call_next):
    try:
        response = await call_next(request)
        # Add CORS headers to all responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response
    except Exception as e:
        from fastapi.responses import JSONResponse
        response = JSONResponse(
            status_code=500,
            content={"detail": str(e)}
        )
        # Add CORS headers to error responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.add_middleware(ActivityLoggingMiddleware)

@app.get("/")
def read_root():
    return {"message": "Shift Management AI API is running", "status": "online"}


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

# Grouping Routers
from app.routes.auth_routes import auth_router
from app.routes.employee_routes import employees_router
from app.routes.schedule_routes import schedules_router
from app.routes.leave_routes import leaves_router
from app.routes.report_routes import reports_router
from app.routes.department_routes import departments_router

def require_role(roles: list):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
        return current_user
    return role_checker

def log_schedule_generation(db: Session, generated_for_date: str, total_assignments: int = 0,
                             trigger_source: str = "manual", user_id: int = None):
    """Helper: record every schedule generation in the log table."""
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

def run_background_schedule_generation(start_date: str):
    global is_generating_schedule
    is_generating_schedule = True
    db = SessionLocal()
    import asyncio
    try:
        from app.services.excel_upload_manager import ExcelUploadManager
        manager = ExcelUploadManager(db)
        print(f"[Background AI] Starting bulk schedule generation for {start_date}...")
        
        asyncio.run(log_activity(
            db=db,
            activity="AI Scheduler Run",
            module_name="AI Scheduler",
            status="success",
            description=f"System triggered background AI schedule generation for date: {start_date}"
        ))
        
        success, msg, summary = manager.generate_weekly_schedule(start_date)
        print(f"[Background AI] Completed: success={success}, msg={msg}")
        
        asyncio.run(log_activity(
            db=db,
            activity="AI Scheduler Run Completed",
            module_name="AI Scheduler",
            status="success" if success else "failed",
            description=f"Background AI scheduling completed: {msg}"
        ))
    except Exception as e:
        print(f"[Background AI] Error in background schedule generation: {e}")
        asyncio.run(log_activity(
            db=db,
            activity="AI Scheduler Run Failed",
            module_name="AI Scheduler",
            status="failed",
            description=f"Background AI scheduling failed: {str(e)}"
        ))
    finally:
        db.close()
        is_generating_schedule = False
@app.get("/schedule-generation-status")
async def get_schedule_generation_status():
    global is_generating_schedule
    return {"is_generating": is_generating_schedule}

def get_current_week_monday(start_date_str: str = None) -> datetime.date:
    if start_date_str:
        dt = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
    else:
        dt = datetime.date.today()
    monday = dt - datetime.timedelta(days=dt.weekday())
    return monday

# Setup initial admin user
@app.on_event("startup")
def startup_event():
    try:
        db = SessionLocal()
        
        # Only attempt schedule generation if employees and shifts exist
        has_employees = db.query(Employee).count() > 0
        has_shifts = db.query(Shift).count() > 0
        if has_employees and has_shifts:
            # Auto-generate schedule for today if not exists/incomplete (with error handling)
            try:
                today = datetime.date.today().isoformat()
                total_employees = db.query(Employee).count()
                schedule_count = db.query(Schedule).filter(Schedule.date == today).count()
                if schedule_count < max(1, total_employees // 2):
                    ai_scheduler.generate_ai_schedule(db, today)
            except Exception as e:
                print(f"[Startup] Error generating today's schedule: {e}")

            # Auto-generate schedule for next week (with error handling)
            try:
                next_monday = datetime.date.today()
                next_monday = next_monday + datetime.timedelta(days=(7 - next_monday.weekday()))
                total_employees = db.query(Employee).count()
                for i in range(7):
                    future_date = next_monday + datetime.timedelta(days=i)
                    date_str = future_date.isoformat()
                    schedule_count = db.query(Schedule).filter(Schedule.date == date_str).count()
                    if schedule_count < max(1, total_employees // 2):
                        ai_scheduler.generate_ai_schedule(db, date_str)
            except Exception as e:
                print(f"[Startup] Error generating next week schedule: {e}")
        else:
            print("[Startup] Skipping schedule generation: no employees or shifts defined.")
        
        db.close()
    except Exception as e:
        print(f"[Startup] Error during startup: {e}")
        if 'db' in locals():
            db.close()

# --- Export System Endpoints ---

from fastapi.responses import StreamingResponse
import io
import pandas as pd

# Include Routers   
app.include_router(auth_router)
app.include_router(overtime_router)
app.include_router(employees_router)
app.include_router(schedules_router)
app.include_router(leaves_router)
app.include_router(reports_router)
app.include_router(departments_router)
app.include_router(activity_router)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


