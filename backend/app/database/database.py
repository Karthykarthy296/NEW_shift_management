from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey, JSON, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
import logging

# Setup database logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DatabaseSetup")

DATABASE_TYPE = "mysql"

MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "rootpassword")
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
MYSQL_DB = os.getenv("MYSQL_DB", "shift_db_new")

# Use pymysql connector with UTF-8 encoding
DATABASE_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}?charset=utf8mb4"
logger.info(f"Connecting to MySQL database at {MYSQL_HOST}:{MYSQL_PORT}...")

try:
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,
        pool_pre_ping=True
    )
    # Test connection to verify MySQL is running and accessible
    with engine.connect() as conn:
        pass
    logger.info("✓ Successfully connected to MySQL database!")
except Exception as e:
    logger.critical(f"❌ Could not connect to MySQL server: {e}")
    raise e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    name = Column(String(100), nullable=True)
    password_hash = Column(String(255))
    role = Column(String(20)) # admin, manager, supervisor

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    code = Column(String(10), unique=True, index=True)
    description = Column(String(255))
    min_staff_per_shift = Column(Integer, default=1)
    max_overtime_weekly = Column(Integer, default=10)
    created_at = Column(DateTime, default=datetime.utcnow)

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    emp_id = Column(String(50), unique=True, index=True) # External Employee ID from Excel
    name = Column(String(100), index=True)
    role = Column(String(100), index=True) # Role from Excel (e.g., Manager, Staff, etc.) with index
    skills = Column(JSON) # List of skills
    preferred_shift = Column(String(50))
    max_hours = Column(Integer)
    weekly_off = Column(String(20)) # Monday, Tuesday, etc.
    leave_status = Column(String(50)) # Leave status from Excel
    department_id = Column(Integer, ForeignKey("departments.id"), index=True)
    
    department = relationship("Department")
    
class Shift(Base):
    __tablename__ = "shifts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50)) # Morning, Evening, Night
    start_time = Column(String(20))
    end_time = Column(String(20))
    required_employees = Column(Integer)

class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(20), index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), index=True)
    is_override = Column(Boolean, default=False)
    replaced_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    
    shift = relationship("Shift")
    employee = relationship("Employee", foreign_keys=[employee_id])
    replaced_employee = relationship("Employee", foreign_keys=[replaced_employee_id])

class Leave(Base):
    __tablename__ = "leaves"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), index=True)
    date = Column(String(20), index=True)
    
    employee = relationship("Employee")

class WeeklyOffSwap(Base):
    __tablename__ = "weekly_off_swaps"
    id = Column(Integer, primary_key=True, index=True)
    employee_1_id = Column(Integer, ForeignKey("employees.id"))
    employee_2_id = Column(Integer, ForeignKey("employees.id"))
    old_off_day = Column(String(20))  # Employee 1's current weekly off day
    new_off_day = Column(String(20))  # Employee 2's current weekly off day (what employee 1 wants)
    status = Column(String(20), default="pending")  # pending, approved, rejected
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    ai_validation_status = Column(JSON, nullable=True)  # AI validation results
    rejection_reason = Column(String(255), nullable=True)
    
    employee_1 = relationship("Employee", foreign_keys=[employee_1_id])
    employee_2 = relationship("Employee", foreign_keys=[employee_2_id])
    approver = relationship("User")

class OvertimeLog(Base):
    __tablename__ = "overtime_logs"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), index=True)
    date = Column(String(20), index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"))
    regular_hours = Column(Float, default=8.0)
    overtime_hours = Column(Float, default=0.0)
    status = Column(String(20), default="pending")  # pending, approved, rejected
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    ai_validation_status = Column(JSON, nullable=True)  # AI validation results
    rejection_reason = Column(String(255), nullable=True)
    week_start_date = Column(String(20), index=True)  # Monday of the week
    
    employee = relationship("Employee")
    shift = relationship("Shift")
    approver = relationship("User")

class WeeklyShiftChange(Base):
    __tablename__ = "weekly_shift_changes"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), index=True)
    week_start_date = Column(String(20), index=True)  # Monday of the week
    original_shift_id = Column(Integer, ForeignKey("shifts.id"))
    new_shift_id = Column(Integer, ForeignKey("shifts.id"))
    change_date = Column(String(20))  # Date of the shift being changed
    reason = Column(String(255))
    status = Column(String(20), default="approved")  # approved, pending, rejected
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    employee = relationship("Employee")
    original_shift = relationship("Shift", foreign_keys=[original_shift_id])
    new_shift = relationship("Shift", foreign_keys=[new_shift_id])
    changer = relationship("User", foreign_keys=[changed_by])


class ScheduleGenerationLog(Base):
    __tablename__ = "schedule_generation_logs"
    id = Column(Integer, primary_key=True, index=True)
    generated_for_date = Column(String(20), index=True)   # The date the schedule was generated for
    generated_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who triggered it (null = auto)
    trigger_source = Column(String(50), default="manual")  # manual, auto-assign, upload, background
    total_assignments = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    generator = relationship("User", foreign_keys=[generated_by])

class WeeklyOffHistory(Base):
    __tablename__ = "weekly_off_history"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), index=True)
    week_start_date = Column(String(20), index=True)  # e.g. "2026-05-18"
    off_day = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    employee = relationship("Employee")
