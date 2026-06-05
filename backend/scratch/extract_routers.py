import os

MAIN_PY = r"c:\Users\prabh\OneDrive\Desktop\NEW_shift_management\backend\main.py"
AUTH_ROUTER_FILE = r"c:\Users\prabh\OneDrive\Desktop\NEW_shift_management\backend\app\routes\auth_routes.py"
EMPLOYEES_ROUTER_FILE = r"c:\Users\prabh\OneDrive\Desktop\NEW_shift_management\backend\app\routes\employee_routes.py"

with open(MAIN_PY, "r", encoding="utf-8") as f:
    lines = f.readlines()

# find indices
auth_start = -1
auth_end = -1
emp_start = -1
emp_end = -1

for i, line in enumerate(lines):
    if line.startswith("@auth_router.post(\"/login\")"):
        auth_start = i
    if auth_start != -1 and line.startswith("    return {\"msg\": \"User deleted successfully\"}") and auth_end == -1:
        auth_end = i + 1 # include this line
        
    if line.startswith("@employees_router.post(\"/employees\")"):
        emp_start = i
    if emp_start != -1 and line.startswith("    return {\"msg\": \"Employee deleted successfully\"}") and emp_end == -1:
        emp_end = i + 1

if auth_start == -1 or emp_start == -1:
    print("Could not find start lines", auth_start, emp_start)
    exit(1)

auth_code = lines[auth_start:auth_end]
emp_code = lines[emp_start:emp_end]

auth_imports = """from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from app.database.database import SessionLocal, User
from app.models import schemas
from app.middleware import auth
from app.utils.activity_logger import log_activity
from fastapi.security import HTTPAuthorizationCredentials

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

auth_router = APIRouter(tags=["Authentication"])

"""

emp_imports = """from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from app.database.database import SessionLocal, User, Employee, Schedule, Leave, WeeklyOffSwap, OvertimeLog, Department, WeeklyShiftChange
from app.models import schemas
from app.middleware import auth
from app.utils.activity_logger import log_activity
from fastapi.security import HTTPAuthorizationCredentials

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

employees_router = APIRouter(tags=["Employees"], dependencies=[Depends(get_current_user)])

"""

with open(AUTH_ROUTER_FILE, "w", encoding="utf-8") as f:
    f.write(auth_imports + "".join(auth_code))

with open(EMPLOYEES_ROUTER_FILE, "w", encoding="utf-8") as f:
    f.write(emp_imports + "".join(emp_code))

new_lines = []
for i, line in enumerate(lines):
    if i >= auth_start and i < auth_end:
        continue
    if i >= emp_start and i < emp_end:
        continue
    
    if line.startswith("auth_router = APIRouter(tags=[\"Authentication\"])"):
        line = "from app.routes.auth_routes import auth_router\n"
    elif line.startswith("employees_router = APIRouter(tags=[\"Employees\"], dependencies=[Depends(get_current_user)])"):
        line = "from app.routes.employee_routes import employees_router\n"
        
    new_lines.append(line)

with open(MAIN_PY, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("Done extracting routers.")
