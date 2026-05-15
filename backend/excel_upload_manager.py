"""
EXCEL UPLOAD MANAGER FOR HRMS
Handles Excel sheet uploads, parsing, and weekly schedule generation
"""

import pandas as pd
import openpyxl
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from database import SessionLocal, Employee, Shift, Schedule, Department
import logging

logger = logging.getLogger(__name__)

class ExcelUploadManager:
    """Manages Excel uploads and schedule generation"""
    
    def __init__(self, db: Session):
        self.db = db
        # Make all columns optional - we'll handle missing data gracefully
        self.required_columns = []  # No strictly required columns
        self.optional_columns = [
            'Employee ID', 'Name', 'Department', 'Role', 
            'Preferred Shift', 'Weekly Off', 'Skills', 'Max Hours',
            'Shift Name', 'Start Time', 'End Time'
        ]
        
    def parse_excel_file(self, file_path: str) -> Tuple[bool, str, List[Dict]]:
        """
        Parse Excel file and validate data structure
        Flexible parsing - handles missing columns gracefully
        
        Returns:
            Tuple[success, message, data]
        """
        try:
            # Read Excel file
            df = pd.read_excel(file_path, sheet_name=0)
            
            # No required columns - we'll handle missing data
            if df.empty:
                return False, "Excel file is empty", []
            
            # Clean and validate data
            data = []
            errors = []
            
            for index, row in df.iterrows():
                try:
                    # Support multiple column names for ID and Name (case-insensitive)
                    row_keys_lower = {str(k).lower().strip(): k for k in row.keys()}
                    
                    # Employee ID detection
                    id_options = ['employee id', 'emp id', 'id', 'empid', 'staff id', 'eid', 'code', 'employee #', 'employee_id']
                    emp_id = None
                    for opt in id_options:
                        if opt in row_keys_lower:
                            val = row.get(row_keys_lower[opt])
                            if not pd.isna(val) and str(val).strip() and str(val).lower() != 'nan':
                                emp_id = str(val).strip()
                                break
                    if not emp_id:
                        emp_id = f'EMP{index+1:04d}'
                    
                    # Employee Name detection
                    name_options = ['employee name', 'name', 'full name', 'emp name', 'staff name', 'person', 'fullname']
                    name = None
                    for opt in name_options:
                        if opt in row_keys_lower:
                            val = row.get(row_keys_lower[opt])
                            if not pd.isna(val) and str(val).strip() and str(val).lower() != 'nan':
                                name = str(val).strip()
                                break
                    if not name:
                        name = f'Employee {emp_id}'
                    
                    # Role from Excel - support multiple common column names (case-insensitive)
                    role_options = ['role in department', 'role', 'designation', 'job title', 'position', 'role/designation', 'job category', 'roles']
                    role = 'Staff'
                    # Convert row keys to lowercase for insensitive matching
                    row_keys_lower = {str(k).lower(): k for k in row.keys()}
                    for opt in role_options:
                        if opt in row_keys_lower:
                            val = row.get(row_keys_lower[opt])
                            if not pd.isna(val) and str(val).strip() and str(val).lower() != 'nan':
                                role = str(val).strip()
                                break
                    
                    # Default department
                    department = str(row.get('Department', 'General')).strip()
                    if pd.isna(department) or not department or department == 'nan':
                        department = 'General'
                    
                    # Preferred shift from Excel (shift_preference column)
                    preferred_shift = str(row.get('Shift Preference', row.get('Preferred Shift', 'Morning'))).strip()
                    if pd.isna(preferred_shift) or not preferred_shift or preferred_shift == 'nan':
                        preferred_shift = 'Morning'
                    
                    # Parse skills
                    skills = self._parse_skills(row.get('Skills', ''))
                    
                    # Default weekly off
                    weekly_off = str(row.get('Weekly Off', 'Sunday')).strip().title()
                    if pd.isna(weekly_off) or not weekly_off or weekly_off == 'nan':
                        weekly_off = 'Sunday'
                    
                    # Leave status from Excel
                    leave_status = str(row.get('Leave Status', 'Present')).strip()
                    if pd.isna(leave_status) or not leave_status or leave_status == 'nan':
                        leave_status = 'Present'
                    # Normalize common variations
                    leave_status_lower = leave_status.lower()
                    if 'present' in leave_status_lower or 'active' in leave_status_lower:
                        leave_status = 'Present'
                    elif 'leave' in leave_status_lower or 'absent' in leave_status_lower:
                        leave_status = 'On Leave'
                    
                    # Default max hours
                    max_hours = row.get('Max Hours', 40)
                    try:
                        max_hours = int(max_hours) if not pd.isna(max_hours) else 40
                    except:
                        max_hours = 40
                    
                    employee_data = {
                        'emp_id': emp_id,
                        'name': name,
                        'role': role,
                        'department': department,
                        'preferred_shift': preferred_shift,
                        'skills': skills,
                        'weekly_off': weekly_off,
                        'leave_status': leave_status,
                        'max_hours': max_hours
                    }
                    
                    # Validate employee data
                    validation_error = self._validate_employee_data(employee_data)
                    if validation_error:
                        errors.append(f"Row {index + 2}: {validation_error}")
                        continue
                    
                    data.append(employee_data)
                    
                except Exception as e:
                    errors.append(f"Row {index + 2}: {str(e)}")
                    continue
            
            if not data:
                return False, f"No valid employee data found. Errors: {'; '.join(errors[:5])}", []
            
            if errors:
                logger.warning(f"Some rows had errors: {'; '.join(errors[:5])}")
            
            return True, f"Successfully parsed {len(data)} employees", data
            
        except Exception as e:
            logger.error(f"Error parsing Excel file: {str(e)}")
            return False, f"Error parsing Excel file: {str(e)}", []
    
    def _parse_skills(self, skills_data) -> List[str]:
        """Parse skills from Excel cell"""
        if pd.isna(skills_data):
            return []
        
        skills_str = str(skills_data).strip()
        if not skills_str:
            return []
        
        # Split by common separators
        separators = [',', ';', '|', '/', '\n']
        for sep in separators:
            if sep in skills_str:
                return [skill.strip() for skill in skills_str.split(sep) if skill.strip()]
        
        return [skills_str]
    
    def _validate_employee_data(self, employee_data: Dict) -> Optional[str]:
        """Validate individual employee data - very permissive"""
        # All fields have defaults, so just validate weekly_off format
        valid_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        if employee_data['weekly_off'] not in valid_days:
            # Try to fix common variations
            day = employee_data['weekly_off'].title()
            if day in valid_days:
                employee_data['weekly_off'] = day
            else:
                # Default to Sunday if invalid
                employee_data['weekly_off'] = 'Sunday'
        
        return None
    
    def import_employees_from_excel(self, file_path: str) -> Tuple[bool, str, int]:
        """
        Import employees from Excel file
        
        Returns:
            Tuple[success, message, employees_imported]
        """
        try:
            # Parse Excel file
            success, message, employee_data = self.parse_excel_file(file_path)
            if not success:
                return False, message, 0
            
            imported_count = 0
            errors = []
            
            # Get or create departments
            departments = {}
            unique_departments = list(set(emp['department'] for emp in employee_data))
            
            for dept_name in unique_departments:
                dept = self.db.query(Department).filter(Department.name == dept_name).first()
                if not dept:
                    dept = Department(
                        name=dept_name,
                        code=dept_name.upper()[:4],
                        description=f"{dept_name} Department",
                        min_staff_per_shift=2,
                        max_overtime_weekly=10
                    )
                    self.db.add(dept)
                    self.db.commit()
                    self.db.refresh(dept)
                
                departments[dept_name] = dept
            
            # Import employees
            for emp_data in employee_data:
                try:
                    # Check if employee already exists
                    existing_emp = self.db.query(Employee).filter(Employee.emp_id == emp_data['emp_id']).first()
                    
                    if existing_emp:
                        # Update existing employee
                        existing_emp.name = emp_data['name']
                        existing_emp.role = emp_data.get('role', 'Staff')
                        existing_emp.department_id = departments[emp_data['department']].id
                        existing_emp.preferred_shift = emp_data['preferred_shift']
                        existing_emp.skills = emp_data['skills']
                        existing_emp.weekly_off = emp_data['weekly_off']
                        existing_emp.leave_status = emp_data.get('leave_status', 'Active')
                        existing_emp.max_hours = emp_data.get('max_hours', 40)
                    else:
                        # Create new employee
                        new_emp = Employee(
                            emp_id=emp_data['emp_id'],
                            name=emp_data['name'],
                            role=emp_data.get('role', 'Staff'),
                            department_id=departments[emp_data['department']].id,
                            preferred_shift=emp_data['preferred_shift'],
                            max_hours=emp_data.get('max_hours', 40),
                            skills=emp_data['skills'],
                            weekly_off=emp_data['weekly_off'],
                            leave_status=emp_data.get('leave_status', 'Active')
                        )
                        self.db.add(new_emp)
                    
                    imported_count += 1
                    
                except Exception as e:
                    errors.append(f"Error importing {emp_data['emp_id']}: {str(e)}")
                    continue
            
            self.db.commit()
            
            if errors:
                message += f" Some errors occurred: {'; '.join(errors[:3])}"
            
            return True, f"Successfully imported {imported_count} employees. {message}", imported_count
            
        except Exception as e:
            logger.error(f"Error importing employees: {str(e)}")
            self.db.rollback()
            return False, f"Error importing employees: {str(e)}", 0
    
    def generate_weekly_schedule(self, start_date: str) -> Tuple[bool, str, Dict]:
        """
        Generate one-week schedule from imported employee data
        
        Returns:
            Tuple[success, message, schedule_summary]
        """
        try:
            # Parse start date
            start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
            
            # Get all employees and shifts
            employees = self.db.query(Employee).all()
            shifts = self.db.query(Shift).all()
            
            if not employees:
                return False, "No employees found in database", {}
            
            if not shifts:
                return False, "No shifts found in database", {}
            
            # Clear existing schedules for the week
            end_date = start_dt + timedelta(days=6)
            self.db.query(Schedule).filter(
                Schedule.date >= start_date,
                Schedule.date <= end_date
            ).delete()
            
            # Generate schedule for each day
            schedule_summary = {
                'start_date': start_date,
                'end_date': end_date,
                'total_days': 7,
                'daily_schedules': {},
                'total_assignments': 0,
                'employees_scheduled': len(employees)
            }
            
            for day_offset in range(7):
                current_date = start_dt + timedelta(days=day_offset)
                day_name = current_date.strftime('%A')
                
                # Generate schedule for this day
                daily_assignments = self._generate_daily_schedule(current_date, employees, shifts)
                
                # Save to database
                for assignment in daily_assignments:
                    schedule = Schedule(
                        date=current_date.isoformat(),
                        shift_id=assignment['shift_id'],
                        employee_id=assignment['employee_id'],
                        is_override=False
                    )
                    self.db.add(schedule)
                
                schedule_summary['daily_schedules'][day_name] = {
                    'date': current_date.isoformat(),
                    'assignments': len(daily_assignments),
                    'employees': [emp['emp_id'] for emp in daily_assignments]
                }
                schedule_summary['total_assignments'] += len(daily_assignments)
            
            self.db.commit()
            
            return True, f"Successfully generated weekly schedule from {start_date} to {end_date}", schedule_summary
            
        except Exception as e:
            logger.error(f"Error generating weekly schedule: {str(e)}")
            self.db.rollback()
            return False, f"Error generating weekly schedule: {str(e)}", {}
    
    def _generate_daily_schedule(self, date: datetime.date, employees: List[Employee], shifts: List[Shift]) -> List[Dict]:
        """Generate schedule for a single day"""
        day_name = date.strftime('%A')
        assignments = []
        assigned_employees = set()
        
        # Filter employees who are not on weekly off
        available_employees = [emp for emp in employees if emp.weekly_off != day_name]
        
        print(f"Generating schedule for {day_name}: {len(available_employees)} available employees out of {len(employees)} total")
        
        # Group employees by department
        dept_groups = {}
        for emp in available_employees:
            if emp.department_id not in dept_groups:
                dept_groups[emp.department_id] = []
            dept_groups[emp.department_id].append(emp)
        
        print(f"Department groups: {[(dept_id, len(emps)) for dept_id, emps in dept_groups.items()]}")
        
        # Assign employees to shifts
        for shift in shifts:
            shift_assignments = []
            
            # Sort employees by preference for this shift
            sorted_employees = sorted(
                available_employees,
                key=lambda emp: (emp.preferred_shift == shift.name, emp.max_hours),
                reverse=True
            )
            
            # Assign employees to shift
            for emp in sorted_employees:
                if len(shift_assignments) >= shift.required_employees:
                    break
                
                if emp.id not in assigned_employees:
                    # Check if employee has enough hours
                    if emp.max_hours >= 8:  # Default 8-hour shift
                        shift_assignments.append({
                            'employee_id': emp.id,
                            'emp_id': emp.emp_id,
                            'name': emp.name,
                            'shift_id': shift.id,
                            'shift_name': shift.name
                        })
                        assigned_employees.add(emp.id)
            
            assignments.extend(shift_assignments)
            print(f"Shift {shift.name}: {len(shift_assignments)} employees assigned")
        
        print(f"Total assignments for {day_name}: {len(assignments)}")
        return assignments
    
    def get_weekly_schedule(self, start_date: str) -> Dict:
        """Get complete weekly schedule"""
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date = start_dt + timedelta(days=6)
            
            # Get schedules for the week
            schedules = self.db.query(Schedule).filter(
                Schedule.date >= start_dt,
                Schedule.date <= end_date
            ).all()
            
            # Organize by day
            weekly_schedule = {
                'start_date': start_date,
                'end_date': end_date,
                'daily_schedules': {}
            }
            
            for day_offset in range(7):
                current_date = start_dt + timedelta(days=day_offset)
                day_name = current_date.strftime('%A')
                date_str = current_date.isoformat()
                
                day_schedules = [s for s in schedules if s.date == date_str]
                
                weekly_schedule['daily_schedules'][day_name] = {
                    'date': date_str,
                    'shifts': {},
                    'total_assignments': len(day_schedules)
                }
                
                # Group by shift
                for sched in day_schedules:
                    shift = self.db.query(Shift).filter(Shift.id == sched.shift_id).first()
                    emp = self.db.query(Employee).filter(Employee.id == sched.employee_id).first()
                    
                    if shift and emp:
                        shift_name = shift.name
                        if shift_name not in weekly_schedule['daily_schedules'][day_name]['shifts']:
                            weekly_schedule['daily_schedules'][day_name]['shifts'][shift_name] = []
                        
                        weekly_schedule['daily_schedules'][day_name]['shifts'][shift_name].append({
                            'emp_id': emp.emp_id,
                            'name': emp.name,
                            'department': emp.department.name if emp.department else 'Unknown',
                            'preferred_shift': emp.preferred_shift,
                            'is_override': sched.is_override
                        })
            
            return weekly_schedule
            
        except Exception as e:
            logger.error(f"Error getting weekly schedule: {str(e)}")
            return {}
    
    def update_shift_assignment(self, date: str, emp_id: str, new_shift: str, reason: str = "") -> Tuple[bool, str]:
        """Update shift assignment for a specific employee"""
        try:
            # Find employee
            emp = self.db.query(Employee).filter(Employee.emp_id == emp_id).first()
            if not emp:
                return False, f"Employee {emp_id} not found"
            
            # Find shift
            shift = self.db.query(Shift).filter(Shift.name == new_shift).first()
            if not shift:
                return False, f"Shift {new_shift} not found"
            
            # Find existing schedule
            existing_schedule = self.db.query(Schedule).filter(
                Schedule.date == date,
                Schedule.employee_id == emp.id
            ).first()
            
            if existing_schedule:
                # Update existing
                old_shift = self.db.query(Shift).filter(Shift.id == existing_schedule.shift_id).first()
                old_shift_name = old_shift.name if old_shift else "Unknown"
                
                existing_schedule.shift_id = shift.id
                existing_schedule.is_override = True
                
                self.db.commit()
                
                return True, f"Updated {emp.name} from {old_shift_name} to {new_shift} on {date}"
            else:
                # Create new assignment
                new_schedule = Schedule(
                    date=date,
                    shift_id=shift.id,
                    employee_id=emp.id,
                    is_override=True
                )
                self.db.add(new_schedule)
                self.db.commit()
                
                return True, f"Assigned {emp.name} to {new_shift} on {date}"
                
        except Exception as e:
            logger.error(f"Error updating shift assignment: {str(e)}")
            self.db.rollback()
            return False, f"Error updating shift assignment: {str(e)}"
