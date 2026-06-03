from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserRegister(BaseModel):
    name: str
    username: str
    role: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str

class UserLogin(BaseModel):
    username: str
    password: str

class LeaveApply(BaseModel):
    employee_name: str
    date: str

class ScheduleUpdate(BaseModel):
    date: str
    shift_id: int
    old_employee_id: int
    new_employee_id: int

class EmployeeCreate(BaseModel):
    emp_id: str
    name: str
    skills: List[str]
    preferred_shift: str
    max_hours: int
    weekly_off: Optional[str] = None

class EmployeeUpdate(BaseModel):
    emp_id: Optional[str] = None
    name: Optional[str] = None
    skills: Optional[List[str]] = None
    preferred_shift: Optional[str] = None
    max_hours: Optional[int] = None
    weekly_off: Optional[str] = None
    department_id: Optional[int] = None

class DepartmentCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    min_staff_per_shift: int = 1
    max_overtime_weekly: int = 10

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    min_staff_per_shift: Optional[int] = None
    max_overtime_weekly: Optional[int] = None

class OvertimeRequest(BaseModel):
    employee_id: int
    date: str
    shift_id: int
    regular_hours: float = 8.0
    overtime_hours: float
    reason: Optional[str] = None

class OvertimeResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    date: str
    shift_id: int
    shift_name: str
    regular_hours: float
    overtime_hours: float
    status: str
    ai_validation_status: Optional[Dict[str, Any]] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    approved_by_name: Optional[str] = None

class OvertimeApproval(BaseModel):
    overtime_id: int
    approve: bool
    rejection_reason: Optional[str] = None

class WeeklyOffSwapRequest(BaseModel):
    employee_1_name: str  # Current user requesting the swap
    employee_2_name: str  # Employee to swap with
    target_off_day: str  # The weekly off day employee 1 wants (employee 2's current off day)

class WeeklyOffSwapResponse(BaseModel):
    id: int
    employee_1_name: str
    employee_2_name: str
    old_off_day: str
    new_off_day: str
    status: str
    ai_validation_status: Optional[Dict[str, Any]] = None
    rejection_reason: Optional[str] = None
    created_at: str
    approved_at: Optional[str] = None
    approved_by_name: Optional[str] = None

class WeeklyOffSwapApproval(BaseModel):
    swap_id: int
    approve: bool
    rejection_reason: Optional[str] = None


class OvertimeCreate(BaseModel):
    employee_id: int
    overtime_hours: float
    overtime_date: str  # YYYY-MM-DD
    reason: Optional[str] = None
    shift: Optional[str] = None
    status: Optional[str] = "pending"


class OvertimeUpdate(BaseModel):
    overtime_hours: Optional[float] = None
    overtime_date: Optional[str] = None
    reason: Optional[str] = None
    shift: Optional[str] = None
    status: Optional[str] = None  # pending, approved, rejected


class OvertimeDbResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    department: str
    shift: str
    overtime_hours: float
    overtime_date: str
    reason: Optional[str] = None
    approved_by: Optional[int] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class EmergencyReplacementRequest(BaseModel):
    date: str
    absent_employee_id: int
    reason: Optional[str] = None

