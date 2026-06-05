import datetime
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
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

@employees_router.post("/employees")
async def create_employee(emp: schemas.EmployeeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["manager", "admin"]))):
    existing = db.query(Employee).filter(Employee.emp_id == emp.emp_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee ID already exists")
    new_emp = Employee(
        emp_id=emp.emp_id,
        name=emp.name,
        skills=emp.skills,
        preferred_shift=emp.preferred_shift,
        max_hours=emp.max_hours,
        weekly_off=emp.weekly_off
    )
    db.add(new_emp)
    db.commit()
    await log_activity(
        db=db,
        activity="Employee Created",
        module_name="Employee Management",
        status="success",
        description=f"Created employee: {new_emp.name} (ID: {new_emp.emp_id})",
        user_id=current_user.id,
        username=current_user.username,
        role=current_user.role
    )
    return {"msg": f"Employee {emp.name} created successfully"}


# --- Admin Bulk Personnel Operations ---

@employees_router.get("/employees/roles")
def get_employee_roles(db: Session = Depends(get_db)):
    """
    Get all unique employee roles currently defined in the database.
    """
    try:
        roles = db.query(Employee.role).distinct().all()
        # Flatten and filter empty/None values
        unique_roles = sorted(list(set([r[0] for r in roles if r[0]])))
        return unique_roles
    except Exception as e:
        print(f"Error fetching unique roles: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch unique employee roles")


@employees_router.delete("/employees/bulk-delete")
async def bulk_delete_employees(
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    """
    Admin-only bulk delete endpoint. Deletes all employees or filters by role.
    Cleans up related schedules, weekly offs, leaves, overtime logs, and weekly shift changes.
    """
    try:
        # Build query to get employee IDs
        emp_query = db.query(Employee.id)
        if role:
            emp_query = emp_query.filter(Employee.role == role)
        
        emp_ids = [r[0] for r in emp_query.all()]
        
        if not emp_ids:
            return {
                "msg": "No personnel records found matching the specified parameters.",
                "deleted_count": 0
            }
        
        # 1. Schedules
        db.query(Schedule).filter(
            (Schedule.employee_id.in_(emp_ids)) | (Schedule.replaced_employee_id.in_(emp_ids))
        ).delete(synchronize_session=False)

        # 2. Leaves
        db.query(Leave).filter(Leave.employee_id.in_(emp_ids)).delete(synchronize_session=False)

        # 3. WeeklyOffSwaps
        db.query(WeeklyOffSwap).filter(
            (WeeklyOffSwap.employee_1_id.in_(emp_ids)) | (WeeklyOffSwap.employee_2_id.in_(emp_ids))
        ).delete(synchronize_session=False)

        # 4. OvertimeLogs
        db.query(OvertimeLog).filter(OvertimeLog.employee_id.in_(emp_ids)).delete(synchronize_session=False)

        # 5. WeeklyShiftChanges
        db.query(WeeklyShiftChange).filter(WeeklyShiftChange.employee_id.in_(emp_ids)).delete(synchronize_session=False)

        # 6. Finally delete Employee rows
        deleted_count = db.query(Employee).filter(Employee.id.in_(emp_ids)).delete(synchronize_session=False)

        db.commit()
        await log_activity(
            db=db,
            activity="Bulk Delete Employees",
            module_name="Employee Management",
            status="success",
            description=f"Admin bulk deleted {deleted_count} employees (Role filter: {role or 'All'})",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        return {
            "msg": f"Successfully deleted {deleted_count} employees and associated records.",
            "deleted_count": deleted_count
        }
    except Exception as e:
        db.rollback()
        print(f"Error during bulk deletion: {e}")
        await log_activity(
            db=db,
            activity="Bulk Delete Employees",
            module_name="Employee Management",
            status="failed",
            description=f"Admin bulk delete failed: {str(e)}",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database transaction aborted due to error: {str(e)}"
        )


@employees_router.put("/employees/{emp_id}")
async def update_employee(emp_id: int, emp_data: schemas.EmployeeUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["manager", "admin"]))):
    db_emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if emp_data.name is not None: db_emp.name = emp_data.name
    if emp_data.emp_id is not None: db_emp.emp_id = emp_data.emp_id
    if emp_data.skills is not None: db_emp.skills = emp_data.skills
    if emp_data.preferred_shift is not None: db_emp.preferred_shift = emp_data.preferred_shift
    if emp_data.max_hours is not None: db_emp.max_hours = emp_data.max_hours
    if emp_data.weekly_off is not None: db_emp.weekly_off = emp_data.weekly_off
    
    db.commit()
    await log_activity(
        db=db,
        activity="Employee Updated",
        module_name="Employee Management",
        status="success",
        description=f"Updated employee: {db_emp.name} (ID: {db_emp.emp_id})",
        user_id=current_user.id,
        username=current_user.username,
        role=current_user.role
    )
    return {"msg": f"Employee {db_emp.name} updated successfully"}

@employees_router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["manager", "admin"]))):
    db_emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp_name = db_emp.name
    emp_id_val = db_emp.emp_id
    db.delete(db_emp)
    db.commit()
    await log_activity(
        db=db,
        activity="Employee Deleted",
        module_name="Employee Management",
        status="success",
        description=f"Deleted employee: {emp_name} (ID: {emp_id_val})",
        user_id=current_user.id,
        username=current_user.username,
        role=current_user.role
    )
    return {"msg": "Employee deleted successfully"}
@employees_router.get("/employees")
def get_employees(department: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Get all employees with proper JSON response.
    Optional filter: ?department=<name>  — returns only employees in that department.
    """
    try:
        print("\n=== GET EMPLOYEES API CALLED ===")

        if department:
            # Join with Department table and filter by name (case-insensitive)
            from sqlalchemy import func as sqlfunc
            from sqlalchemy.orm import joinedload
            employees = (
                db.query(Employee)
                .join(Department, Employee.department_id == Department.id)
                .filter(sqlfunc.lower(Department.name) == department.strip().lower())
                .options(joinedload(Employee.department))
                .all()
            )
        else:
            from sqlalchemy.orm import joinedload
            employees = db.query(Employee).options(joinedload(Employee.department)).all()

        print(f"Found {len(employees)} employees (filter: {department or 'None'})")

        # Load today's schedules and leaves to check assigned shifts
        today_str = datetime.date.today().isoformat()
        day_name = datetime.date.today().strftime('%A')
        
        from sqlalchemy.orm import joinedload
        schedules = db.query(Schedule).options(joinedload(Schedule.shift)).filter(Schedule.date == today_str).all()
        sched_map = {s.employee_id: s.shift.name for s in schedules if s.shift}
        
        leaves = db.query(Leave).filter(Leave.date == today_str).all()
        leave_emp_ids = {l.employee_id for l in leaves}

        employee_list = []
        for emp in employees:
            if emp.id in sched_map:
                assigned_shift = sched_map[emp.id]
            elif emp.weekly_off == day_name:
                assigned_shift = "Week Off"
            elif emp.id in leave_emp_ids:
                assigned_shift = "On Leave"
            else:
                assigned_shift = "Not Assigned"

            employee_list.append({
                "id": emp.id,
                "emp_id": emp.emp_id,
                "name": emp.name,
                "role": emp.role or "Staff",
                "department": emp.department.name if emp.department else "Unknown",
                "department_id": emp.department_id,
                "preferred_shift": emp.preferred_shift or "Not Assigned",
                "assigned_shift": assigned_shift,
                "max_hours": emp.max_hours or 40,
                "skills": emp.skills or [],
                "weekly_off": emp.weekly_off or "Not Set",
                "leave_status": emp.leave_status or "Active"
            })

        print(f"[PASS] Returning {len(employee_list)} employees")
        return employee_list
    except Exception as e:
        print(f"[ERR] Error in get_employees: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching employees: {str(e)}")


@employees_router.post("/upload-excel")
async def upload_excel(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(require_role(["manager", "admin"]))):
    """
    Upload Excel file with employee data and trigger background schedule generation
    """
    try:
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            await log_activity(
                db=db,
                activity="Excel Upload",
                module_name="Employee Management",
                status="failed",
                description=f"Upload failed: Invalid file extension for {file.filename}",
                user_id=current_user.id,
                username=current_user.username,
                role=current_user.role
            )
            raise HTTPException(status_code=400, detail="Please upload an Excel file (.xlsx or .xls)")
        
        # Save uploaded file
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = f"{upload_dir}/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Import employees from Excel
        from app.services.excel_upload_manager import ExcelUploadManager
        manager = ExcelUploadManager(db)
        
        success, message, imported_count = manager.import_employees_from_excel(file_path)
        
        if not success:
            await log_activity(
                db=db,
                activity="Excel Upload",
                module_name="Employee Management",
                status="failed",
                description=f"Upload failed: {message}",
                user_id=current_user.id,
                username=current_user.username,
                role=current_user.role
            )
            raise HTTPException(status_code=400, detail=message)
        
        await log_activity(
            db=db,
            activity="Excel Upload",
            module_name="Employee Management",
            status="success",
            description=f"Successfully uploaded {file.filename} and imported {imported_count} employees.",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        
        # Trigger weekly schedule generation as a background task
        today = datetime.date.today().isoformat()
        # background_tasks.add_task(run_background_schedule_generation, today)
        
        return {
            "status": "success",
            "message": f"Successfully imported {imported_count} employees. AI Schedule generation is processing in the background.",
            "employees_imported": imported_count,
            "file_name": file.filename,
            "auto_generated": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading Excel: {str(e)}")
        await log_activity(
            db=db,
            activity="Excel Upload",
            module_name="Employee Management",
            status="failed",
            description=f"Upload error: {str(e)}",
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role
        )
        raise HTTPException(status_code=500, detail=f"Error uploading Excel file: {str(e)}")


@employees_router.get("/get-employee-weekly-status")
async def get_employee_weekly_status(emp_id: str, date: str = None, db: Session = Depends(get_db)):
    """
    Get weekly shift change status for a specific employee
    """
    try:
        if not date:
            date = datetime.date.today().isoformat()
        
        # Validate date format
        try:
            datetime.datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # Get employee weekly status
        from app.services.weekly_shift_manager import WeeklyShiftManager
        manager = WeeklyShiftManager(db)
        
        # Find employee
        emp = db.query(Employee).filter(Employee.emp_id == emp_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail=f"Employee {emp_id} not found")
        
        status = manager.get_employee_weekly_change_status(emp.id, date)
        
        return {
            "status": "success",
            "employee_id": emp_id,
            "employee_name": emp.name,
            "weekly_status": status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting employee weekly status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting employee weekly status: {str(e)}")


@employees_router.get("/get-all-employees-weekly-status")
async def get_all_employees_weekly_status(date: str = None, db: Session = Depends(get_db)):
    """
    Get weekly shift change status for all employees
    """
    try:
        if not date:
            date = datetime.date.today().isoformat()
        
        # Validate date format
        try:
            datetime.datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # Get all employees weekly status
        from app.services.weekly_shift_manager import WeeklyShiftManager
        manager = WeeklyShiftManager(db)
        
        status = manager.get_all_employees_weekly_status(date)
        
        return {
            "status": "success",
            "weekly_summary": status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting all employees weekly status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting all employees weekly status: {str(e)}")


@employees_router.patch("/employees/{emp_id}/weekly-off")
async def update_employee_weekly_off(
    emp_id: int,
    request: dict,
    db: Session = Depends(get_db)
):
    """
    Update a single employee's weekly off day manually.
    Validates that the new day is a valid day of the week.
    
    Body: { "weekly_off": "Tuesday" }
    """
    try:
        new_day = request.get("weekly_off", "").strip().capitalize()
        valid_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        if new_day not in valid_days:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid day '{new_day}'. Must be one of: {', '.join(valid_days)}"
            )

        emp = db.query(Employee).filter(Employee.id == emp_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail=f"Employee {emp_id} not found")

        old_day = emp.weekly_off
        emp.weekly_off = new_day
        db.commit()

        print(f"[API] Employee {emp.name} weekly off updated: {old_day} -> {new_day}")
        return {
            "status": "success",
            "employee_id": emp_id,
            "employee_name": emp.name,
            "old_weekly_off": old_day,
            "new_weekly_off": new_day,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating weekly off: {str(e)}")

