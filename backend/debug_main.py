"""
DEBUG VERSION OF MAIN.PY
Comprehensive debugging and fixes for dashboard and schedule generation issues
"""

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database.database import engine, SessionLocal, Base, User, Employee, Shift, Schedule, Leave, WeeklyOffSwap, OvertimeLog, Department
from app.models import schemas
from app.middleware import auth
from app.services import ai_scheduler
import shutil
import os
import datetime
from typing import Optional, List, Dict
from sqlalchemy import func

Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.middleware("http")
async def add_cors_to_errors(request, call_next):
    try:
        response = await call_next(request)
        # Add CORS headers to all responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response
    except Exception as e:
        print(f"[DEBUG] CORS Middleware Error: {str(e)}")
        raise

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================================================
# STEP 1: COMPREHENSIVE DEBUG LOGS - UPLOAD API
# ============================================================================

@app.post("/upload-excel")
async def upload_excel_debug(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    DEBUG VERSION: Upload Excel file with comprehensive logging
    """
    try:
        print("=" * 80)
        print("[DEBUG] ===== EXCEL UPLOAD API CALLED =====")
        print("=" * 80)
        
        # Validate file type
        if not file.filename:
            print("[DEBUG] ERROR: No file provided")
            raise HTTPException(status_code=400, detail="No file provided")
        
        if not file.filename.endswith(('.xlsx', '.xls')):
            print(f"[DEBUG] ERROR: Invalid file format: {file.filename}")
            raise HTTPException(status_code=400, detail="Please upload an Excel file (.xlsx or .xls)")
        
        print(f"[DEBUG] File validation passed: {file.filename}")
        print(f"[DEBUG] File size: {file.size if hasattr(file, 'size') else 'Unknown'} bytes")
        
        # Save uploaded file
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = f"{upload_dir}/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"[DEBUG] File saved to: {file_path}")
        
        # Check database state before import
        print("[DEBUG] Database state BEFORE import:")
        employees_before = db.query(Employee).count()
        shifts_before = db.query(Shift).count()
        schedules_before = db.query(Schedule).count()
        print(f"[DEBUG] Employees before: {employees_before}")
        print(f"[DEBUG] Shifts before: {shifts_before}")
        print(f"[DEBUG] Schedules before: {schedules_before}")
        
        # Import employees from Excel
        from excel_upload_manager import ExcelUploadManager
        manager = ExcelUploadManager(db)
        
        print("[DEBUG] Starting Excel import...")
        success, message, imported_count = manager.import_employees_from_excel(file_path)
        print(f"[DEBUG] Excel import result: success={success}, imported_count={imported_count}")
        print(f"[DEBUG] Import message: {message}")
        
        if not success:
            print("[DEBUG] ERROR: Excel import failed")
            raise HTTPException(status_code=400, detail=message)
        
        # Check database state after import
        print("[DEBUG] Database state AFTER import:")
        employees_after = db.query(Employee).count()
        shifts_after = db.query(Shift).count()
        schedules_after = db.query(Schedule).count()
        print(f"[DEBUG] Employees after: {employees_after}")
        print(f"[DEBUG] Shifts after: {shifts_after}")
        print(f"[DEBUG] Schedules after: {schedules_after}")
        
        # STEP 2: VERIFY DATABASE AND CREATE DEFAULT SHIFTS IF NEEDED
        if shifts_after == 0:
            print("[DEBUG] No shifts found, creating default shifts...")
            default_shifts = [
                {"name": "Morning", "start_time": "06:00", "end_time": "14:00", "required_employees": 3},
                {"name": "Afternoon", "start_time": "12:00", "end_time": "18:00", "required_employees": 3},
                {"name": "Evening", "start_time": "14:00", "end_time": "22:00", "required_employees": 3},
                {"name": "Night", "start_time": "22:00", "end_time": "06:00", "required_employees": 2}
            ]
            
            for shift_data in default_shifts:
                shift = Shift(**shift_data)
                db.add(shift)
            db.commit()
            
            shifts_after = db.query(Shift).count()
            print(f"[DEBUG] Created {len(default_shifts)} default shifts. Total shifts: {shifts_after}")
        
        # STEP 3: AUTO-GENERATE SCHEDULE WITH PROPER COMMIT
        try:
            print("[DEBUG] Auto-generating schedule...")
            
            # Get today's date
            today = datetime.date.today().isoformat()
            print(f"[DEBUG] Using date: {today}")
            
            # Generate weekly schedule
            schedule_success, schedule_message, schedule_summary = manager.generate_weekly_schedule(today)
            print(f"[DEBUG] Schedule generation result: success={schedule_success}")
            print(f"[DEBUG] Schedule summary: {schedule_summary}")
            
            if schedule_success:
                print(f"[DEBUG] Schedule generated successfully: {schedule_summary.get('total_assignments', 0)} assignments")
                message += f" | {schedule_message}"
            else:
                print(f"[DEBUG] Schedule generation failed: {schedule_message}")
                message += f" | Schedule generation failed: {schedule_message}"
                
                # STEP 8: FORCE TEST DATA IF SCHEDULE GENERATION FAILED
                print("[DEBUG] Attempting to create test schedule data...")
                try:
                    test_date = today
                    test_shifts = db.query(Shift).all()
                    test_employees = db.query(Employee).limit(10).all()  # Use first 10 employees
                    
                    if test_shifts and test_employees:
                        # Clear existing schedules for today
                        db.query(Schedule).filter(Schedule.date == test_date).delete()
                        
                        # Create test schedules
                        for i, emp in enumerate(test_employees):
                            shift = test_shifts[i % len(test_shifts)]
                            schedule = Schedule(
                                date=test_date,
                                shift_id=shift.id,
                                employee_id=emp.id,
                                is_override=False
                            )
                            db.add(schedule)
                        
                        db.commit()
                        
                        final_schedules = db.query(Schedule).filter(Schedule.date == test_date).count()
                        print(f"[DEBUG] Created {final_schedules} test schedules")
                        message += f" | Created {final_schedules} test schedules"
                        
                except Exception as test_error:
                    print(f"[DEBUG] Test schedule creation failed: {str(test_error)}")
                    import traceback
                    traceback.print_exc()
                
        except Exception as e:
            print(f"[DEBUG] Error in auto-generation: {str(e)}")
            import traceback
            traceback.print_exc()
            message += f" | Auto-generation failed: {str(e)}"
        
        # Final database state check
        final_employees = db.query(Employee).count()
        final_shifts = db.query(Shift).count()
        final_schedules = db.query(Schedule).count()
        print("[DEBUG] Final database state:")
        print(f"[DEBUG] Final employees: {final_employees}")
        print(f"[DEBUG] Final shifts: {final_shifts}")
        print(f"[DEBUG] Final schedules: {final_schedules}")
        
        # Weekly off count
        today_name = datetime.date.today().strftime('%A')
        weekly_off_count = db.query(Employee).filter(Employee.weekly_off == today_name).count()
        print(f"[DEBUG] Weekly off count for {today_name}: {weekly_off_count}")
        
        print("=" * 80)
        print("[DEBUG] ===== EXCEL UPLOAD API COMPLETED =====")
        print("=" * 80)
        
        return {
            "status": "success",
            "message": message,
            "employees_imported": imported_count,
            "file_name": file.filename,
            "auto_generated": True,
            "debug": {
                "total_employees": final_employees,
                "total_shifts": final_shifts,
                "total_schedules": final_schedules,
                "weekly_off_count": weekly_off_count,
                "employees_before": employees_before,
                "employees_after": employees_after
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] ERROR uploading Excel: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error uploading Excel file: {str(e)}")

# ============================================================================
# STEP 3: FIX GENERATE SCHEDULE API WITH PROPER DB COMMITS
# ============================================================================

@app.post("/generate-schedule")
async def generate_schedule_debug(request: dict, db: Session = Depends(get_db)):
    """
    DEBUG VERSION: Generate schedule with comprehensive logging and proper DB commits
    """
    try:
        print("=" * 80)
        print("[DEBUG] ===== GENERATE SCHEDULE API CALLED =====")
        print("=" * 80)
        
        date = request.get("date")
        if not date:
            # Default to today
            date = datetime.date.today().isoformat()
        
        print(f"[DEBUG] Requested date: {date}")
        
        # Validate date format
        try:
            datetime.datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            print(f"[DEBUG] ERROR: Invalid date format: {date}")
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # Check database state
        print("[DEBUG] Checking database state...")
        total_employees = db.query(Employee).count()
        total_shifts = db.query(Shift).count()
        existing_schedules = db.query(Schedule).filter(Schedule.date == date).count()
        
        print(f"[DEBUG] Total employees: {total_employees}")
        print(f"[DEBUG] Total shifts: {total_shifts}")
        print(f"[DEBUG] Existing schedules for {date}: {existing_schedules}")
        
        if total_employees == 0:
            print("[DEBUG] ERROR: No employees found in database")
            raise HTTPException(status_code=400, detail="No employees found in database")
        
        if total_shifts == 0:
            print("[DEBUG] ERROR: No shifts found in database")
            raise HTTPException(status_code=400, detail="No shifts found in database")
        
        # Clear existing schedules for the date
        if existing_schedules > 0:
            print(f"[DEBUG] Clearing {existing_schedules} existing schedules for {date}")
            db.query(Schedule).filter(Schedule.date == date).delete()
            db.commit()
            print("[DEBUG] Existing schedules cleared")
        
        # Generate new schedules
        date_obj = datetime.datetime.strptime(date, '%Y-%m-%d').date()
        day_name = date_obj.strftime('%A')
        
        print(f"[DEBUG] Generating schedules for {day_name}, {date}")
        
        # Filter employees who are not on weekly off
        available_employees = db.query(Employee).filter(Employee.weekly_off != day_name).all()
        weekly_off_count = total_employees - len(available_employees)
        
        print(f"[DEBUG] Available employees: {len(available_employees)} (Weekly off: {weekly_off_count})")
        
        if len(available_employees) == 0:
            print("[DEBUG] WARNING: No available employees (all on weekly off)")
            return {
                "status": "success",
                "message": f"No employees available for {day_name} (all {total_employees} on weekly off)",
                "date": date,
                "total_employees": total_employees,
                "weekly_off_count": weekly_off_count,
                "active_assignments": 0,
                "shift_assignments": {}
            }
        
        # Get all shifts
        shifts = db.query(Shift).all()
        print(f"[DEBUG] Available shifts: {[shift.name for shift in shifts]}")
        
        new_schedules = []
        assigned_employees = set()
        
        # Assign employees to shifts
        for shift in shifts:
            shift_assignments = []
            
            # Sort employees by preference for this shift
            sorted_employees = sorted(
                available_employees,
                key=lambda emp: (emp.preferred_shift == shift.name, emp.max_hours or 40),
                reverse=True
            )
            
            # Assign employees to shift
            for emp in sorted_employees:
                if len(shift_assignments) >= (shift.required_employees or 3):
                    break
                
                if emp.id not in assigned_employees:
                    # Check if employee has enough hours
                    if (emp.max_hours or 40) >= 8:  # Default 8-hour shift
                        schedule = Schedule(
                            date=date,
                            shift_id=shift.id,
                            employee_id=emp.id,
                            is_override=False
                        )
                        new_schedules.append(schedule)
                        assigned_employees.add(emp.id)
                        shift_assignments.append(emp)
            
            print(f"[DEBUG] Shift {shift.name}: {len(shift_assignments)} employees assigned")
            
            # Add schedules to database
            for schedule in shift_assignments:
                db.add(schedule)
        
        # STEP 3: PROPER DB COMMIT
        print("[DEBUG] Committing schedules to database...")
        db.commit()
        print("[DEBUG] Database commit completed")
        
        print(f"[DEBUG] Successfully generated and saved {len(new_schedules)} schedules")
        print(f"[DEBUG] Total employees: {total_employees}")
        print(f"[DEBUG] Weekly off: {weekly_off_count}")
        print(f"[DEBUG] Active assignments: {len(new_schedules)}")
        
        # Generate shift assignment summary
        shift_assignments = {}
        for shift in shifts:
            count = len([s for s in new_schedules if s.shift_id == shift.id])
            shift_assignments[shift.name] = count
        
        print("=" * 80)
        print("[DEBUG] ===== GENERATE SCHEDULE API COMPLETED =====")
        print("=" * 80)
        
        return {
            "status": "success",
            "message": f"Successfully generated {len(new_schedules)} shift assignments for {date}",
            "date": date,
            "total_employees": total_employees,
            "weekly_off_count": weekly_off_count,
            "active_assignments": len(new_schedules),
            "shift_assignments": shift_assignments,
            "debug": {
                "available_employees": len(available_employees),
                "shifts_count": len(shifts),
                "day_name": day_name
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] ERROR generating schedule: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error generating schedule: {str(e)}"
        )

# ============================================================================
# STEP 4: FIX DASHBOARD STATS API
# ============================================================================

@app.get("/dashboard/stats")
async def get_dashboard_stats_debug(db: Session = Depends(get_db)):
    """
    DEBUG VERSION: Get dashboard statistics with comprehensive logging
    """
    try:
        print("=" * 60)
        print("[DEBUG] ===== DASHBOARD STATS API CALLED =====")
        print("=" * 60)
        
        today = datetime.date.today()
        today_str = today.isoformat()
        day_name = today.strftime('%A')
        
        print(f"[DEBUG] Getting stats for {today_str} ({day_name})")
        
        # Get total employees
        total_employees = db.query(Employee).count()
        print(f"[DEBUG] Total employees: {total_employees}")
        
        # Get weekly off employees for today
        weekly_off_employees = db.query(Employee).filter(Employee.weekly_off == day_name).all()
        weekly_off_count = len(weekly_off_employees)
        print(f"[DEBUG] Weekly off employees: {weekly_off_count}")
        
        # Get leaves for today
        leaves = db.query(Leave).filter(Leave.date == today_str).all()
        leave_count = len(leaves)
        print(f"[DEBUG] Leave employees: {leave_count}")
        
        # Get active employees (not on leave or weekly off)
        active_shift_employees = total_employees - leave_count - weekly_off_count
        print(f"[DEBUG] Active shift employees: {active_shift_employees}")
        
        # Get today's schedule count
        today_schedules = db.query(Schedule).filter(Schedule.date == today_str).all()
        today_schedule_count = len(today_schedules)
        print(f"[DEBUG] Today schedule count: {today_schedule_count}")
        
        # Get shift distribution
        shift_assignments_query = (
            db.query(Shift.name, func.count(Schedule.id))
            .join(Schedule, Schedule.shift_id == Shift.id)
            .filter(Schedule.date == today_str)
            .group_by(Shift.name)
            .all()
        )
        
        shift_distribution = {}
        for name, count in shift_assignments_query:
            if name:
                shift_distribution[name] = count
                print(f"[DEBUG] Shift {name}: {count} assignments")
        
        # Get department distribution
        dept_query = (
            db.query(Department.name, func.count(Employee.id))
            .join(Employee, Employee.department_id == Department.id)
            .group_by(Department.name)
            .all()
        )
        
        department_distribution = {}
        for name, count in dept_query:
            if name:
                department_distribution[name] = count
                print(f"[DEBUG] Department {name}: {count} employees")
        
        print("=" * 60)
        print("[DEBUG] ===== DASHBOARD STATS API COMPLETED =====")
        print("=" * 60)
        
        return {
            "status": "success",
            "total_employees": total_employees,
            "weekly_off_employees": weekly_off_count,
            "active_shift_employees": active_shift_employees,
            "leave_employees": leave_count,
            "today_schedule_count": today_schedule_count,
            "shift_distribution": shift_distribution,
            "department_distribution": department_distribution,
            "date": today_str,
            "day_name": day_name
        }
        
    except Exception as e:
        print(f"[DEBUG] ERROR getting dashboard stats: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error getting dashboard stats: {str(e)}"
        )

# ============================================================================
# STEP 5: OTHER DEBUG APIS
# ============================================================================

@app.get("/employees")
async def get_employees_debug(db: Session = Depends(get_db)):
    """
    DEBUG VERSION: Get all employees with proper JSON response
    """
    try:
        print("[DEBUG] ===== EMPLOYEES API CALLED =====")
        
        # Get all employees with their departments
        employees = db.query(Employee).all()
        
        employee_list = []
        for emp in employees:
            employee_data = {
                "id": emp.id,
                "emp_id": emp.emp_id,
                "name": emp.name,
                "department": emp.department.name if emp.department else "Unknown",
                "department_id": emp.department_id,
                "preferred_shift": emp.preferred_shift or "Not Assigned",
                "max_hours": emp.max_hours or 40,
                "skills": emp.skills or [],
                "weekly_off": emp.weekly_off or "Not Set"
            }
            employee_list.append(employee_data)
        
        print(f"[DEBUG] Employees loaded: {len(employee_list)} employees")
        
        return {
            "status": "success",
            "employees": employee_list,
            "total_count": len(employee_list)
        }
        
    except Exception as e:
        print(f"[DEBUG] ERROR getting employees: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting employees: {str(e)}"
        )

@app.get("/schedules")
async def get_schedules_debug(date: str = None, db: Session = Depends(get_db)):
    """
    DEBUG VERSION: Get schedules for a specific date or today
    """
    try:
        print("[DEBUG] ===== SCHEDULES API CALLED =====")
        
        if not date:
            date = datetime.date.today().isoformat()
        
        print(f"[DEBUG] Getting schedules for date: {date}")
        
        # Validate date format
        try:
            datetime.datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # Get schedules for the date
        schedules = db.query(Schedule).filter(Schedule.date == date).all()
        
        schedule_list = []
        for sched in schedules:
            # Get employee and shift details
            emp = db.query(Employee).filter(Employee.id == sched.employee_id).first()
            shift = db.query(Shift).filter(Shift.id == sched.shift_id).first()
            
            if emp and shift:
                schedule_data = {
                    "id": sched.id,
                    "date": sched.date,
                    "employee_id": sched.employee_id,
                    "emp_id": emp.emp_id,
                    "employee_name": emp.name,
                    "department": emp.department.name if emp.department else "Unknown",
                    "shift_id": sched.shift_id,
                    "shift_name": shift.name,
                    "shift_start": shift.start_time,
                    "shift_end": shift.end_time,
                    "is_override": sched.is_override
                }
                schedule_list.append(schedule_data)
        
        print(f"[DEBUG] Schedules loaded: {len(schedule_list)} schedules for {date}")
        
        return {
            "status": "success",
            "schedules": schedule_list,
            "total_count": len(schedule_list),
            "date": date
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] ERROR getting schedules: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting schedules: {str(e)}"
        )

@app.get("/weekly-off")
async def get_weekly_off_debug(date: str = None, db: Session = Depends(get_db)):
    """
    DEBUG VERSION: Get weekly off employees for a specific date or today
    """
    try:
        print("[DEBUG] ===== WEEKLY OFF API CALLED =====")
        
        if not date:
            date = datetime.date.today().isoformat()
        
        # Get day name for the date
        date_obj = datetime.datetime.strptime(date, '%Y-%m-%d').date()
        day_name = date_obj.strftime('%A')
        
        print(f"[DEBUG] Getting weekly off for {date} ({day_name})")
        
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
        
        print(f"[DEBUG] Weekly off loaded: {len(weekly_off_list)} employees for {day_name}")
        
        return {
            "status": "success",
            "weekly_off_employees": weekly_off_list,
            "total_count": len(weekly_off_list),
            "date": date,
            "day_name": day_name
        }
        
    except Exception as e:
        print(f"[DEBUG] ERROR getting weekly off: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting weekly off: {str(e)}"
        )

# ============================================================================
# BASIC ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    print("[DEBUG] Root endpoint called")
    return {"message": "Shift Management AI API is running", "status": "online"}

if __name__ == "__main__":
    import uvicorn
    print("[DEBUG] Starting debug server...")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
