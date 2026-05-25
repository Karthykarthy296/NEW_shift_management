"""
WEEKLY SHIFT CHANGE MANAGER
Handles one shift change per week limitation for employees
"""

from datetime import datetime, timedelta
from typing import Tuple, Optional, List, Dict
from sqlalchemy.orm import Session
from app.database.database import SessionLocal, Employee, Shift, Schedule, WeeklyShiftChange, User
import logging

logger = logging.getLogger(__name__)

class WeeklyShiftManager:
    """Manages weekly shift change limitations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_week_start_date(self, date_str: str) -> str:
        """Get the Monday (week start) for a given date"""
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # Find Monday of this week
        monday = date - timedelta(days=date.weekday())
        return monday.isoformat()
    
    def has_employee_changed_shift_this_week(self, employee_id: int, date: str) -> bool:
        """
        Check if employee has already changed their shift this week
        
        Returns:
            bool: True if employee has already changed shift this week
        """
        try:
            week_start = self.get_week_start_date(date)
            
            # Check if there's any approved shift change for this employee this week
            existing_change = self.db.query(WeeklyShiftChange).filter(
                WeeklyShiftChange.employee_id == employee_id,
                WeeklyShiftChange.week_start_date == week_start,
                WeeklyShiftChange.status == 'approved'
            ).first()
            
            return existing_change is not None
            
        except Exception as e:
            logger.error(f"Error checking weekly shift change: {str(e)}")
            return False
    
    def get_employee_weekly_change_status(self, employee_id: int, date: str) -> Dict:
        """
        Get detailed weekly change status for an employee
        
        Returns:
            Dict with change status, remaining changes, and change history
        """
        try:
            week_start = self.get_week_start_date(date)
            
            # Get all changes for this week
            changes = self.db.query(WeeklyShiftChange).filter(
                WeeklyShiftChange.employee_id == employee_id,
                WeeklyShiftChange.week_start_date == week_start
            ).all()
            
            approved_changes = [c for c in changes if c.status == 'approved']
            pending_changes = [c for c in changes if c.status == 'pending']
            
            return {
                'week_start_date': week_start,
                'has_changed_this_week': len(approved_changes) > 0,
                'remaining_changes': 1 - len(approved_changes),  # Only 1 change allowed per week
                'total_changes_this_week': len(changes),
                'approved_changes': len(approved_changes),
                'pending_changes': len(pending_changes),
                'can_change': len(approved_changes) == 0,
                'change_history': [
                    {
                        'id': change.id,
                        'change_date': change.change_date,
                        'original_shift': change.original_shift.name if change.original_shift else 'Unknown',
                        'new_shift': change.new_shift.name if change.new_shift else 'Unknown',
                        'reason': change.reason,
                        'status': change.status,
                        'created_at': change.created_at.isoformat()
                    }
                    for change in changes
                ]
            }
            
        except Exception as e:
            logger.error(f"Error getting weekly change status: {str(e)}")
            return {
                'week_start_date': self.get_week_start_date(date),
                'has_changed_this_week': False,
                'remaining_changes': 1,
                'total_changes_this_week': 0,
                'approved_changes': 0,
                'pending_changes': 0,
                'can_change': True,
                'change_history': []
            }
    
    def update_shift_assignment_with_limitation(self, date: str, emp_id: str, new_shift: str, reason: str = "", user_id: int = None) -> Tuple[bool, str]:
        """
        Update shift assignment with weekly limitation check
        
        Returns:
            Tuple[success, message]
        """
        try:
            # Find employee
            emp = self.db.query(Employee).filter(Employee.emp_id == emp_id).first()
            if not emp:
                return False, f"Employee {emp_id} not found"
            
            # Check if employee has already changed shift this week
            if self.has_employee_changed_shift_this_week(emp.id, date):
                return False, f"Employee {emp.name} has already used their one shift change for this week"
            
            # Find new shift
            shift = self.db.query(Shift).filter(Shift.name == new_shift).first()
            if not shift:
                return False, f"Shift {new_shift} not found"
            
            # Find existing schedule
            existing_schedule = self.db.query(Schedule).filter(
                Schedule.date == date,
                Schedule.employee_id == emp.id
            ).first()
            
            original_shift_id = None
            if existing_schedule:
                original_shift_id = existing_schedule.shift_id
                # Update existing
                existing_schedule.shift_id = shift.id
                existing_schedule.is_override = True
            else:
                # Create new assignment
                new_schedule = Schedule(
                    date=date,
                    shift_id=shift.id,
                    employee_id=emp.id,
                    is_override=True
                )
                self.db.add(new_schedule)
            
            # Record the weekly shift change
            week_start = self.get_week_start_date(date)
            shift_change = WeeklyShiftChange(
                employee_id=emp.id,
                week_start_date=week_start,
                original_shift_id=original_shift_id,
                new_shift_id=shift.id,
                change_date=date,
                reason=reason,
                status='approved',
                changed_by=user_id
            )
            self.db.add(shift_change)
            
            self.db.commit()
            
            original_shift_name = "Unknown"
            if original_shift_id:
                orig_shift = self.db.query(Shift).filter(Shift.id == original_shift_id).first()
                original_shift_name = orig_shift.name if orig_shift else "Unknown"
            
            return True, f"Updated {emp.name} from {original_shift_name} to {new_shift} on {date}. (1/1 weekly changes used)"
            
        except Exception as e:
            logger.error(f"Error updating shift assignment with limitation: {str(e)}")
            self.db.rollback()
            return False, f"Error updating shift assignment: {str(e)}"
    
    def get_all_employees_weekly_status(self, date: str) -> Dict:
        """
        Get weekly change status for all employees
        
        Returns:
            Dict with employee-wise weekly status
        """
        try:
            week_start = self.get_week_start_date(date)
            
            # Get all employees
            employees = self.db.query(Employee).all()
            
            employees_status = {}
            
            for emp in employees:
                status = self.get_employee_weekly_change_status(emp.id, date)
                employees_status[emp.emp_id] = {
                    'name': emp.name,
                    'department': emp.department.name if emp.department else 'Unknown',
                    'preferred_shift': emp.preferred_shift,
                    **status
                }
            
            return {
                'week_start_date': week_start,
                'total_employees': len(employees),
                'employees_can_change': len([e for e in employees_status.values() if e['can_change']]),
                'employees_already_changed': len([e for e in employees_status.values() if e['has_changed_this_week']]),
                'employees_status': employees_status
            }
            
        except Exception as e:
            logger.error(f"Error getting all employees weekly status: {str(e)}")
            return {}
    
    def request_shift_change(self, date: str, emp_id: str, new_shift: str, reason: str = "", user_id: int = None) -> Tuple[bool, str]:
        """
        Request a shift change (for approval workflow)
        
        Returns:
            Tuple[success, message]
        """
        try:
            # Find employee
            emp = self.db.query(Employee).filter(Employee.emp_id == emp_id).first()
            if not emp:
                return False, f"Employee {emp_id} not found"
            
            # Check if employee has already changed shift this week
            if self.has_employee_changed_shift_this_week(emp.id, date):
                return False, f"Employee {emp.name} has already used their one shift change for this week"
            
            # Check if there's already a pending request
            week_start = self.get_week_start_date(date)
            existing_pending = self.db.query(WeeklyShiftChange).filter(
                WeeklyShiftChange.employee_id == emp.id,
                WeeklyShiftChange.week_start_date == week_start,
                WeeklyShiftChange.status == 'pending'
            ).first()
            
            if existing_pending:
                return False, f"Employee {emp.name} already has a pending shift change request for this week"
            
            # Find new shift
            shift = self.db.query(Shift).filter(Shift.name == new_shift).first()
            if not shift:
                return False, f"Shift {new_shift} not found"
            
            # Find existing schedule to get original shift
            existing_schedule = self.db.query(Schedule).filter(
                Schedule.date == date,
                Schedule.employee_id == emp.id
            ).first()
            
            original_shift_id = None
            if existing_schedule:
                original_shift_id = existing_schedule.shift_id
            
            # Create pending shift change request
            shift_change = WeeklyShiftChange(
                employee_id=emp.id,
                week_start_date=week_start,
                original_shift_id=original_shift_id,
                new_shift_id=shift.id,
                change_date=date,
                reason=reason,
                status='pending',
                changed_by=user_id
            )
            self.db.add(shift_change)
            self.db.commit()
            
            return True, f"Shift change request submitted for {emp.name} on {date}. Awaiting approval."
            
        except Exception as e:
            logger.error(f"Error requesting shift change: {str(e)}")
            self.db.rollback()
            return False, f"Error requesting shift change: {str(e)}"
    
    def approve_shift_change(self, change_id: int, user_id: int) -> Tuple[bool, str]:
        """
        Approve a pending shift change request
        
        Returns:
            Tuple[success, message]
        """
        try:
            # Find the shift change request
            change = self.db.query(WeeklyShiftChange).filter(WeeklyShiftChange.id == change_id).first()
            if not change:
                return False, "Shift change request not found"
            
            if change.status != 'pending':
                return False, f"Request is already {change.status}"
            
            # Update the actual schedule
            existing_schedule = self.db.query(Schedule).filter(
                Schedule.date == change.change_date,
                Schedule.employee_id == change.employee_id
            ).first()
            
            if existing_schedule:
                existing_schedule.shift_id = change.new_shift_id
                existing_schedule.is_override = True
            else:
                # Create new schedule
                new_schedule = Schedule(
                    date=change.change_date,
                    shift_id=change.new_shift_id,
                    employee_id=change.employee_id,
                    is_override=True
                )
                self.db.add(new_schedule)
            
            # Update the change record
            change.status = 'approved'
            change.changed_by = user_id
            
            self.db.commit()
            
            emp = self.db.query(Employee).filter(Employee.id == change.employee_id).first()
            new_shift = self.db.query(Shift).filter(Shift.id == change.new_shift_id).first()
            
            return True, f"Approved shift change for {emp.name} to {new_shift.name} on {change.change_date}"
            
        except Exception as e:
            logger.error(f"Error approving shift change: {str(e)}")
            self.db.rollback()
            return False, f"Error approving shift change: {str(e)}"
    
    def reject_shift_change(self, change_id: int, user_id: int, rejection_reason: str = "") -> Tuple[bool, str]:
        """
        Reject a pending shift change request
        
        Returns:
            Tuple[success, message]
        """
        try:
            # Find the shift change request
            change = self.db.query(WeeklyShiftChange).filter(WeeklyShiftChange.id == change_id).first()
            if not change:
                return False, "Shift change request not found"
            
            if change.status != 'pending':
                return False, f"Request is already {change.status}"
            
            # Update the change record
            change.status = 'rejected'
            change.changed_by = user_id
            # Add rejection reason to the reason field
            if rejection_reason:
                change.reason = f"Rejected: {rejection_reason}"
            
            self.db.commit()
            
            emp = self.db.query(Employee).filter(Employee.id == change.employee_id).first()
            
            return True, f"Rejected shift change request for {emp.name}"
            
        except Exception as e:
            logger.error(f"Error rejecting shift change: {str(e)}")
            self.db.rollback()
            return False, f"Error rejecting shift change: {str(e)}"
