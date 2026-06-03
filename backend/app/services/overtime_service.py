from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException
from datetime import datetime, timedelta
from typing import Optional, List
from app.database.database import Overtime, Employee, Leave, Schedule, Department, Shift, User
from app.services import ai_scheduler

class OvertimeService:
    @staticmethod
    def validate_overtime(
        db: Session,
        employee_id: int,
        overtime_date: str,
        overtime_hours: float,
        exclude_id: Optional[int] = None
    ) -> Employee:
        # 1. Fetch employee
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        # 2. Prevent duplicate manual OT entries for the same employee/date
        dup_query = db.query(Overtime).filter(
            Overtime.employee_id == employee_id,
            Overtime.overtime_date == overtime_date
        )
        if exclude_id is not None:
            dup_query = dup_query.filter(Overtime.id != exclude_id)
        
        if dup_query.first():
            raise HTTPException(
                status_code=400,
                detail="An overtime record already exists for this employee on this date."
            )

        # 3. Call the unified AI scheduler validation
        result = ai_scheduler.validate_overtime_request(
            db=db,
            employee_id=employee_id,
            date=overtime_date,
            overtime_hours=overtime_hours,
            exclude_ot_id=exclude_id
        )
        if not result["valid"]:
            raise HTTPException(
                status_code=400,
                detail="Overtime validation failed: " + "; ".join(result["reasons"])
            )

        return employee

    @staticmethod
    def add_overtime(
        db: Session,
        employee_id: int,
        overtime_hours: float,
        overtime_date: str,
        reason: Optional[str] = None,
        shift_name: Optional[str] = None,
        status: str = "pending",
        approved_by_id: Optional[int] = None
    ) -> Overtime:
        # Validate rules and get employee
        employee = OvertimeService.validate_overtime(
            db=db,
            employee_id=employee_id,
            overtime_date=overtime_date,
            overtime_hours=overtime_hours
        )

        # Determine shift name if not provided
        if not shift_name:
            schedule = db.query(Schedule).filter(
                Schedule.employee_id == employee_id,
                Schedule.date == overtime_date
            ).first()
            if schedule and schedule.shift:
                shift_name = schedule.shift.name
            else:
                shift_name = "General"

        # Department name
        dept_name = employee.department.name if employee.department else "General"

        # Create Overtime Entry
        ot_entry = Overtime(
            employee_id=employee_id,
            employee_name=employee.name,
            department=dept_name,
            shift=shift_name,
            overtime_hours=overtime_hours,
            overtime_date=overtime_date,
            reason=reason,
            approved_by=approved_by_id if status == "approved" else None,
            status=status
        )

        db.add(ot_entry)
        db.commit()
        db.refresh(ot_entry)
        return ot_entry

    @staticmethod
    def update_overtime(
        db: Session,
        ot_id: int,
        overtime_hours: Optional[float] = None,
        overtime_date: Optional[str] = None,
        reason: Optional[str] = None,
        shift_name: Optional[str] = None,
        status: Optional[str] = None,
        approved_by_id: Optional[int] = None
    ) -> Overtime:
        ot_entry = db.query(Overtime).filter(Overtime.id == ot_id).first()
        if not ot_entry:
            raise HTTPException(status_code=404, detail="Overtime record not found")

        # If date or hours are changing, re-validate
        val_date = overtime_date if overtime_date is not None else ot_entry.overtime_date
        val_hours = overtime_hours if overtime_hours is not None else ot_entry.overtime_hours
        
        if overtime_date is not None or overtime_hours is not None:
            # Re-validate
            OvertimeService.validate_overtime(
                db=db,
                employee_id=ot_entry.employee_id,
                overtime_date=val_date,
                overtime_hours=val_hours,
                exclude_id=ot_id
            )
            ot_entry.overtime_date = val_date
            ot_entry.overtime_hours = val_hours

        # Update other fields
        if reason is not None:
            ot_entry.reason = reason
        if shift_name is not None:
            ot_entry.shift = shift_name
        if status is not None:
            ot_entry.status = status
            if status == "approved":
                ot_entry.approved_by = approved_by_id
            elif status == "rejected" or status == "pending":
                ot_entry.approved_by = None

        db.commit()
        db.refresh(ot_entry)
        return ot_entry

    @staticmethod
    def delete_overtime(db: Session, ot_id: int) -> bool:
        ot_entry = db.query(Overtime).filter(Overtime.id == ot_id).first()
        if not ot_entry:
            raise HTTPException(status_code=404, detail="Overtime record not found")
        db.delete(ot_entry)
        db.commit()
        return True

    @staticmethod
    def get_overtime_list(
        db: Session,
        employee_id: Optional[int] = None,
        department: Optional[str] = None,
        date: Optional[str] = None,
        shift: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Overtime]:
        query = db.query(Overtime)

        if employee_id:
            query = query.filter(Overtime.employee_id == employee_id)
        if department:
            query = query.filter(Overtime.department == department)
        if date:
            query = query.filter(Overtime.overtime_date == date)
        if shift:
            query = query.filter(Overtime.shift == shift)
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    Overtime.employee_name.like(search_filter),
                    Overtime.department.like(search_filter),
                    Overtime.reason.like(search_filter)
                )
            )

        # Sort: newest date first, then by id descending
        return query.order_by(Overtime.overtime_date.desc(), Overtime.id.desc()).all()

    @staticmethod
    def get_overtime_stats(db: Session):
        today_str = datetime.today().strftime("%Y-%m-%d")
        
        # 1. Total OT Hours (approved only)
        total_hours = db.query(func.sum(Overtime.overtime_hours)).filter(
            Overtime.status == "approved"
        ).scalar() or 0.0

        # 2. OT Employees Today (approved or pending today)
        employees_today = db.query(func.count(func.distinct(Overtime.employee_id))).filter(
            Overtime.overtime_date == today_str,
            Overtime.status != "rejected"
        ).scalar() or 0

        # 3. Department-wise OT (approved only)
        dept_ot = db.query(Overtime.department, func.sum(Overtime.overtime_hours)).filter(
            Overtime.status == "approved"
        ).group_by(Overtime.department).all()
        
        department_wise = {dept: hours for dept, hours in dept_ot if dept}

        # 4. Monthly OT Summary (past 6 months)
        # We group by YYYY-MM
        monthly_ot = []
        today = datetime.today()
        for i in range(5, -1, -1):
            month_date = today - timedelta(days=i*30)
            month_str = month_date.strftime("%Y-%m")
            month_label = month_date.strftime("%b %Y")
            
            hours = db.query(func.sum(Overtime.overtime_hours)).filter(
                Overtime.overtime_date.like(f"{month_str}%"),
                Overtime.status == "approved"
            ).scalar() or 0.0
            
            monthly_ot.append({
                "month": month_label,
                "hours": float(hours)
            })

        return {
            "total_hours": float(total_hours),
            "employees_today": int(employees_today),
            "department_wise": department_wise,
            "monthly_summary": monthly_ot
        }
