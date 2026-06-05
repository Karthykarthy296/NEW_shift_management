import ast
import os

MAIN_PY = r"c:\Users\prabh\OneDrive\Desktop\NEW_shift_management\backend\main.py"

ROUTERS = {
    "employees_router": r"c:\Users\prabh\OneDrive\Desktop\NEW_shift_management\backend\app\routes\employee_routes.py",
    "schedules_router": r"c:\Users\prabh\OneDrive\Desktop\NEW_shift_management\backend\app\routes\schedule_routes.py",
    "leaves_router": r"c:\Users\prabh\OneDrive\Desktop\NEW_shift_management\backend\app\routes\leave_routes.py",
    "reports_router": r"c:\Users\prabh\OneDrive\Desktop\NEW_shift_management\backend\app\routes\report_routes.py",
    "departments_router": r"c:\Users\prabh\OneDrive\Desktop\NEW_shift_management\backend\app\routes\department_routes.py",
}

IMPORTS = """from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Query
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

"""

ROUTER_INIT = {
    "schedules_router": 'schedules_router = APIRouter(tags=["Schedules"], dependencies=[Depends(get_current_user)])',
    "leaves_router": 'leaves_router = APIRouter(tags=["Leaves & Time Off"], dependencies=[Depends(get_current_user)])',
    "reports_router": 'reports_router = APIRouter(tags=["Reports & Dashboard"], dependencies=[Depends(get_current_user)])',
    "departments_router": 'departments_router = APIRouter(tags=["Departments"], dependencies=[Depends(get_current_user)])',
}

with open(MAIN_PY, "r", encoding="utf-8") as f:
    source_lines = f.readlines()
    source_code = "".join(source_lines)

tree = ast.parse(source_code)

to_remove_lines = set()
extracted_code = {k: [] for k in ROUTERS}

for node in tree.body:
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute):
                if isinstance(decorator.func.value, ast.Name):
                    router_name = decorator.func.value.id
                    if router_name in ROUTERS:
                        # Extract this node
                        start_lineno = node.lineno - 1
                        # Include decorators
                        if node.decorator_list:
                            start_lineno = node.decorator_list[0].lineno - 1
                            
                        end_lineno = node.end_lineno
                        
                        code_segment = "".join(source_lines[start_lineno:end_lineno])
                        extracted_code[router_name].append(code_segment)
                        
                        for i in range(start_lineno, end_lineno):
                            to_remove_lines.add(i)

# Now write out the extracted files
for router_name, router_path in ROUTERS.items():
    if not extracted_code[router_name]:
        continue
        
    mode = "a" if os.path.exists(router_path) and router_name == "employees_router" else "w"
    
    with open(router_path, mode, encoding="utf-8") as f:
        if mode == "w":
            f.write(IMPORTS + "\n")
            if router_name in ROUTER_INIT:
                f.write(ROUTER_INIT[router_name] + "\n\n")
        f.write("\n\n".join(extracted_code[router_name]) + "\n")

# Reconstruct main.py
new_main_lines = []
i = 0
while i < len(source_lines):
    if i in to_remove_lines:
        i += 1
        continue
        
    line = source_lines[i]
    # Replace router initializations with imports
    if line.startswith('schedules_router = APIRouter(tags=["Schedules"]'):
        new_main_lines.append("from app.routes.schedule_routes import schedules_router\n")
    elif line.startswith('leaves_router = APIRouter(tags=["Leaves & Time Off"]'):
        new_main_lines.append("from app.routes.leave_routes import leaves_router\n")
    elif line.startswith('reports_router = APIRouter(tags=["Reports & Dashboard"]'):
        new_main_lines.append("from app.routes.report_routes import reports_router\n")
    elif line.startswith('departments_router = APIRouter(tags=["Departments"]'):
        new_main_lines.append("from app.routes.department_routes import departments_router\n")
    else:
        new_main_lines.append(line)
    i += 1

with open(MAIN_PY, "w", encoding="utf-8") as f:
    f.writelines(new_main_lines)

print("Extraction complete.")
