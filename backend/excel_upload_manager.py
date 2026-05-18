"""
EXCEL UPLOAD MANAGER FOR HRMS
Handles Excel sheet uploads, parsing, and weekly schedule generation
"""

import pandas as pd
import openpyxl
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from database import SessionLocal, Employee, Shift, Schedule, Department, Leave
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
        Import employees from Excel file - Highly Optimized Batch Processor for 50,000+ records.
        
        Returns:
            Tuple[success, message, employees_imported]
        """
        try:
            # Parse Excel file
            success, message, employee_data = self.parse_excel_file(file_path)
            if not success:
                return False, message, 0
            
            imported_count = 0
            
            # Preload all existing departments to avoid N+1 queries
            all_depts = self.db.query(Department).all()
            departments = {dept.name: dept for dept in all_depts}
            
            # Get unique departments from Excel to create missing ones
            unique_departments = list(set(emp['department'] for emp in employee_data))
            new_depts = []
            for dept_name in unique_departments:
                if dept_name not in departments:
                    new_dept = Department(
                        name=dept_name,
                        code=dept_name.upper()[:4],
                        description=f"{dept_name} Department",
                        min_staff_per_shift=2,
                        max_overtime_weekly=10
                    )
                    new_depts.append(new_dept)
            
            if new_depts:
                self.db.add_all(new_depts)
                self.db.commit()
                # Reload departments mapping
                all_depts = self.db.query(Department).all()
                departments = {dept.name: dept for dept in all_depts}
            
            # Preload all existing employees by emp_id to avoid SELECT queries inside the loop
            all_emps = self.db.query(Employee).all()
            existing_employees = {emp.emp_id: emp for emp in all_emps}
            
            # Separate into updates and new inserts
            new_employee_objs = []
            
            for emp_data in employee_data:
                emp_id = emp_data['emp_id']
                dept_name = emp_data['department']
                dept_id = departments[dept_name].id
                
                # Graceful fallback/auto-correct for missing role
                role = emp_data.get('role', 'Staff')
                if not role or str(role).strip().lower() == 'nan':
                    role = 'Staff'
                
                # Graceful fallback/auto-correct for preferred shift
                preferred_shift = emp_data.get('preferred_shift', 'Morning')
                if not preferred_shift or str(preferred_shift).strip().lower() == 'nan':
                    preferred_shift = 'Morning'
                
                # Graceful fallback/auto-correct for weekly off
                weekly_off = emp_data.get('weekly_off', 'Sunday')
                if not weekly_off or str(weekly_off).strip().lower() == 'nan':
                    weekly_off = 'Sunday'
                
                if emp_id in existing_employees:
                    # Update existing employee object already attached to the session
                    existing_emp = existing_employees[emp_id]
                    existing_emp.name = emp_data['name']
                    existing_emp.role = role
                    existing_emp.department_id = dept_id
                    existing_emp.preferred_shift = preferred_shift
                    existing_emp.skills = emp_data.get('skills', [])
                    existing_emp.weekly_off = weekly_off
                    existing_emp.leave_status = emp_data.get('leave_status', 'Present')
                    existing_emp.max_hours = emp_data.get('max_hours', 40)
                else:
                    # Create new employee
                    new_emp = Employee(
                        emp_id=emp_id,
                        name=emp_data['name'],
                        role=role,
                        department_id=dept_id,
                        preferred_shift=preferred_shift,
                        max_hours=emp_data.get('max_hours', 40),
                        skills=emp_data.get('skills', []),
                        weekly_off=weekly_off,
                        leave_status=emp_data.get('leave_status', 'Present')
                    )
                    new_employee_objs.append(new_emp)
                
                imported_count += 1
            
            # Bulk save new employees
            if new_employee_objs:
                self.db.add_all(new_employee_objs)
            
            self.db.commit()
            return True, f"Successfully imported {imported_count} employees.", imported_count
            
        except Exception as e:
            logger.error(f"Error importing employees: {str(e)}")
            self.db.rollback()
            return False, f"Error importing employees: {str(e)}", 0
    
    def generate_weekly_schedule(self, start_date: str) -> Tuple[bool, str, Dict]:
        """
        Generate one-week schedule from imported employee data - Highly Optimized Enterprise AI Algorithm.
        
        Returns:
            Tuple[success, message, schedule_summary]
        """
        try:
            # Parse start date
            start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date = start_dt + timedelta(days=6)
            
            # Preload all employees, departments, and shifts
            employees = self.db.query(Employee).all()
            shifts = self.db.query(Shift).all()
            
            if not employees:
                return False, "No employees found in database", {}
            
            if not shifts:
                # Seed default shifts if missing
                defaults = [
                    ("Morning", "06:00", "12:00"),
                    ("Afternoon", "12:00", "18:00"),
                    ("Evening", "18:00", "00:00"),
                    ("Night", "00:00", "06:00")
                ]
                for name, start, end in defaults:
                    self.db.add(Shift(name=name, start_time=start, end_time=end, required_employees=2))
                self.db.commit()
                shifts = self.db.query(Shift).all()
            
            # Calculate current week number for fair off-rotation
            week_num = start_dt.isocalendar()[1]
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            
            # Auto-balance and rotate weekly offs if not set
            updated_offs = []
            for i, emp in enumerate(employees):
                if not emp.weekly_off or str(emp.weekly_off).strip().lower() == 'nan' or emp.weekly_off == 'Not Set':
                    emp.weekly_off = days[(i + week_num) % 7]
                    updated_offs.append(emp)
            
            if updated_offs:
                self.db.commit()
                # Reload employees
                employees = self.db.query(Employee).all()
            
            # Preload all leaves for this date range in one query
            leaves_query = self.db.query(Leave).filter(
                Leave.date >= start_date,
                Leave.date <= end_date.isoformat()
            ).all()
            
            # Group leaves by date: {date_str: {employee_id}}
            leaves_by_date = {}
            for l in leaves_query:
                d_str = l.date
                if d_str not in leaves_by_date:
                    leaves_by_date[d_str] = set()
                leaves_by_date[d_str].add(l.employee_id)
            
            # Clear existing schedules for the week in one quick bulk delete
            self.db.query(Schedule).filter(
                Schedule.date >= start_date,
                Schedule.date <= end_date.isoformat()
            ).delete(synchronize_session=False)
            self.db.flush()
            
            # Bulk scheduling engine: build list of dict mappings
            schedule_mappings = []
            total_assignments = 0
            
            schedule_summary = {
                'start_date': start_date,
                'end_date': end_date.isoformat(),
                'total_days': 7,
                'daily_schedules': {},
                'total_assignments': 0,
                'employees_scheduled': len(employees)
            }
            
            # Pre-sort employees by preferred shift to speed up selection
            # We want to match preferred shift first, then distribute others
            employees_by_pref = {s.name: [] for s in shifts}
            employees_by_pref['Other'] = []
            for emp in employees:
                if emp.preferred_shift in employees_by_pref:
                    employees_by_pref[emp.preferred_shift].append(emp)
                else:
                    employees_by_pref['Other'].append(emp)
            
            # Loop for 7 days
            for day_offset in range(7):
                current_date = start_dt + timedelta(days=day_offset)
                date_str = current_date.isoformat()
                day_name = current_date.strftime('%A')
                
                leaves_today = leaves_by_date.get(date_str, set())
                
                # Filter available employees: not on weekly off today, not on leave, active leave_status
                available = [
                    emp for emp in employees
                    if emp.id not in leaves_today 
                    and emp.weekly_off != day_name 
                    and emp.leave_status != 'On Leave'
                ]
                
                assigned_today = set()
                daily_assignments_count = 0
                
                # For each shift, assign employees
                for shift in shifts:
                    # Preferred candidates: available and have preferred_shift matching shift name
                    pref_candidates = [
                        e for e in available 
                        if e.preferred_shift == shift.name and e.id not in assigned_today
                    ]
                    
                    # Secondary candidates: any other available
                    other_candidates = [
                        e for e in available 
                        if e.preferred_shift != shift.name and e.id not in assigned_today
                    ]
                    
                    # Merge candidates
                    candidates = pref_candidates + other_candidates
                    
                    # Take required employees or whatever is available
                    required = shift.required_employees or 2
                    assigned_to_shift = candidates[:required]
                    
                    for emp in assigned_to_shift:
                        schedule_mappings.append({
                            "date": date_str,
                            "shift_id": shift.id,
                            "employee_id": emp.id,
                            "is_override": False
                        })
                        assigned_today.add(emp.id)
                        daily_assignments_count += 1
                        total_assignments += 1
                
                schedule_summary['daily_schedules'][day_name] = {
                    'date': date_str,
                    'assignments': daily_assignments_count
                }
            
            # Bulk insert all schedule records at once
            if schedule_mappings:
                self.db.bulk_insert_mappings(Schedule, schedule_mappings)
            
            self.db.commit()
            schedule_summary['total_assignments'] = total_assignments
            
            return True, f"Successfully generated weekly schedule: {total_assignments} assignments generated.", schedule_summary
            
        except Exception as e:
            logger.error(f"Error generating weekly schedule: {str(e)}")
            self.db.rollback()
            return False, f"Error generating weekly schedule: {str(e)}", {}
    
    def _generate_daily_schedule(self, date: datetime.date, employees: List[Employee], shifts: List[Shift]) -> List[Dict]:
        return []
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
