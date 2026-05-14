"""
PERFORMANCE OPTIMIZATIONS FOR 1000+ EMPLOYEES
Enterprise-grade optimizations for HRMS scheduling system
"""

import asyncio
from functools import lru_cache
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, and_, or_, text
from database import Employee, Shift, Schedule, Department, Leave
from datetime import datetime, timedelta
import time
import logging
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor
import pandas as pd

logger = logging.getLogger(__name__)

class PerformanceOptimizer:
    """Enterprise performance optimizer for large-scale HRMS"""
    
    def __init__(self, db: Session):
        self.db = db
        self.executor = ThreadPoolExecutor(max_workers=4)
        
    @lru_cache(maxsize=128)
    def get_shift_durations(self) -> Dict[int, float]:
        """Cache shift durations to avoid repeated calculations"""
        try:
            shifts = self.db.query(Shift).all()
            durations = {}
            for shift in shifts:
                start = datetime.strptime(shift.start_time, "%H:%M")
                end = datetime.strptime(shift.end_time, "%H:%M")
                if end < start:
                    end += timedelta(days=1)
                duration = (end - start).total_seconds() / 3600
                durations[shift.id] = duration
            return durations
        except Exception as e:
            logger.error(f"Error caching shift durations: {str(e)}")
            return {}
    
    @lru_cache(maxsize=256)
    def get_employee_by_id(self, emp_id: int) -> Optional[Employee]:
        """Cache employee lookups"""
        try:
            return self.db.query(Employee).filter(Employee.id == emp_id).first()
        except Exception as e:
            logger.error(f"Error caching employee {emp_id}: {str(e)}")
            return None
    
    def get_employees_bulk_optimized(self, department_id: Optional[int] = None) -> List[Employee]:
        """Optimized bulk employee fetching with strategic loading"""
        try:
            query = self.db.query(Employee)
            
            if department_id:
                query = query.filter(Employee.department_id == department_id)
            
            # Use selectinload for better performance with large datasets
            employees = query.options(
                selectinload(Employee.department)
            ).all()
            
            return employees
        except Exception as e:
            logger.error(f"Error in bulk employee fetch: {str(e)}")
            return []
    
    def get_schedule_bulk_optimized(self, date: str, department_id: Optional[int] = None) -> List[Schedule]:
        """Optimized schedule fetching with minimal queries"""
        try:
            query = self.db.query(Schedule).filter(Schedule.date == date)
            
            if department_id:
                # Join with employees to filter by department
                query = query.join(Employee).filter(Employee.department_id == department_id)
            
            # Strategic relationship loading for performance
            schedules = query.options(
                joinedload(Schedule.shift),
                joinedload(Schedule.employee).selectinload(Employee.department),
                joinedload(Schedule.replaced_employee)
            ).all()
            
            return schedules
        except Exception as e:
            logger.error(f"Error in bulk schedule fetch: {str(e)}")
            return []
    
    def get_department_statistics(self, date: str) -> Dict[int, Dict]:
        """Get department-wise statistics with optimized queries"""
        try:
            # Single query for department stats
            dept_stats = self.db.query(
                Department.id,
                Department.name,
                func.count(Employee.id).label('employee_count'),
                func.coalesce(func.count(Schedule.id), 0).label('schedule_count')
            ).outerjoin(
                Employee, Department.id == Employee.department_id
            ).outerjoin(
                Schedule, and_(
                    Employee.id == Schedule.employee_id,
                    Schedule.date == date
                )
            ).group_by(Department.id, Department.name).all()
            
            stats = {}
            for dept_id, dept_name, emp_count, sched_count in dept_stats:
                stats[dept_id] = {
                    'name': dept_name,
                    'employee_count': emp_count or 0,
                    'schedule_count': sched_count or 0,
                    'coverage_percentage': (sched_count / emp_count * 100) if emp_count > 0 else 0
                }
            
            return stats
        except Exception as e:
            logger.error(f"Error in department statistics: {str(e)}")
            return {}
    
    def generate_schedule_parallel(self, date: str, departments: List[Department]) -> Dict:
        """Parallel schedule generation for large departments"""
        start_time = time.time()
        
        try:
            # Split departments by size for parallel processing
            large_depts = [d for d in departments if self.get_department_employee_count(d.id) > 100]
            small_depts = [d for d in departments if d not in large_depts]
            
            results = {}
            
            # Process large departments in parallel
            if large_depts:
                with ThreadPoolExecutor(max_workers=min(4, len(large_depts))) as executor:
                    futures = {
                        executor.submit(self.generate_department_schedule, date, dept): dept 
                        for dept in large_depts
                    }
                    
                    for future in asyncio.wrap_future(asyncio.get_event_loop(), future):
                        dept = futures[future]
                        try:
                            result = future.result(timeout=60)
                            results[dept.id] = result
                        except Exception as e:
                            logger.error(f"Parallel scheduling failed for dept {dept.id}: {str(e)}")
                            results[dept.id] = {'error': str(e)}
            
            # Process small departments sequentially
            for dept in small_depts:
                try:
                    result = self.generate_department_schedule(date, dept)
                    results[dept.id] = result
                except Exception as e:
                    logger.error(f"Sequential scheduling failed for dept {dept.id}: {str(e)}")
                    results[dept.id] = {'error': str(e)}
            
            processing_time = time.time() - start_time
            logger.info(f"Parallel schedule generation completed in {processing_time:.2f}s")
            
            return {
                'status': 'success',
                'departments': results,
                'processing_time': processing_time,
                'total_departments': len(departments)
            }
            
        except Exception as e:
            logger.error(f"Parallel schedule generation failed: {str(e)}")
            return {
                'status': 'error',
                'error': str(e),
                'processing_time': time.time() - start_time
            }
    
    def get_department_employee_count(self, department_id: int) -> int:
        """Fast employee count for department"""
        try:
            return self.db.query(Employee).filter(Employee.department_id == department_id).count()
        except Exception:
            return 0
    
    def generate_department_schedule(self, date: str, department: Department) -> Dict:
        """Generate schedule for a single department with optimizations"""
        try:
            # Get department employees with optimized loading
            employees = self.get_employees_bulk_optimized(department.id)
            
            if not employees:
                return {
                    'department_id': department.id,
                    'department_name': department.name,
                    'assignments': 0,
                    'employees': 0,
                    'status': 'no_employees'
                }
            
            # Get shifts once
            shifts = self.db.query(Shift).all()
            shift_durations = self.get_shift_durations()
            
            # Get leaves for date
            leave_ids = set()
            try:
                leaves = self.db.query(Leave).filter(Leave.date == date).all()
                leave_ids = {leave.employee_id for leave in leaves}
            except Exception as e:
                logger.error(f"Error fetching leaves: {str(e)}")
            
            # Optimized scheduling algorithm
            assignments = self._optimized_department_scheduling(
                employees, shifts, shift_durations, leave_ids, department.min_staff_per_shift
            )
            
            return {
                'department_id': department.id,
                'department_name': department.name,
                'assignments': len(assignments),
                'employees': len(employees),
                'status': 'success',
                'assignments_detail': assignments
            }
            
        except Exception as e:
            logger.error(f"Department schedule generation failed for {department.id}: {str(e)}")
            return {
                'department_id': department.id,
                'department_name': department.name,
                'status': 'error',
                'error': str(e)
            }
    
    def _optimized_department_scheduling(self, employees: List[Employee], shifts: List[Shift], 
                                      shift_durations: Dict[int, float], leave_ids: set, 
                                      min_staff: int) -> List[Dict]:
        """Optimized scheduling algorithm for department"""
        assignments = []
        assigned_employees = set()
        
        # Filter available employees
        available_employees = [e for e in employees if e.id not in leave_ids]
        
        # Pre-calculate employee scores for performance
        employee_scores = {}
        for emp in available_employees:
            score = 0
            # Preference scoring
            for shift in shifts:
                if emp.preferred_shift == shift.name:
                    score -= 10  # Negative score = better preference
            employee_scores[emp.id] = score
        
        # Department-wise scheduling
        for shift in shifts:
            shift_assignments = []
            shift_duration = shift_durations.get(shift.id, 8)
            
            # Sort employees by preference score
            sorted_employees = sorted(
                available_employees, 
                key=lambda e: employee_scores.get(e.id, 0)
            )
            
            for emp in sorted_employees:
                if len(shift_assignments) >= shift.required_employees:
                    break
                if emp.id not in assigned_employees:
                    # Check hours constraint
                    # Simplified for performance - in production, track actual hours
                    if emp.max_hours >= shift_duration:
                        shift_assignments.append(emp.id)
                        assigned_employees.add(emp.id)
            
            # Ensure minimum staff per department
            while len(shift_assignments) < min_staff and available_employees:
                remaining = [e for e in available_employees if e.id not in assigned_employees]
                if not remaining:
                    break
                emp = remaining[0]
                if emp.max_hours >= shift_duration:
                    shift_assignments.append(emp.id)
                    assigned_employees.add(emp.id)
                available_employees.remove(emp)
            
            # Create assignment records
            for emp_id in shift_assignments:
                assignments.append({
                    'shift_id': shift.id,
                    'employee_id': emp_id,
                    'date': date,
                    'department_optimized': True
                })
        
        return assignments
    
    def get_performance_metrics(self) -> Dict:
        """Get system performance metrics"""
        try:
            # Database performance metrics
            db_metrics = {}
            
            # Employee count
            db_metrics['total_employees'] = self.db.query(Employee).count()
            
            # Department count
            db_metrics['total_departments'] = self.db.query(Department).count()
            
            # Schedule count for today
            today = datetime.now().date().isoformat()
            db_metrics['today_schedules'] = self.db.query(Schedule).filter(Schedule.date == today).count()
            
            # Cache hit rates
            db_metrics['shift_duration_cache_size'] = len(self.get_shift_durations.cache_info())
            db_metrics['employee_cache_size'] = len(self.get_employee_by_id.cache_info())
            
            # Memory usage (simplified)
            import psutil
            process = psutil.Process()
            db_metrics['memory_usage_mb'] = process.memory_info().rss / 1024 / 1024
            
            return {
                'timestamp': datetime.now().isoformat(),
                'database_metrics': db_metrics,
                'system_status': 'healthy'
            }
            
        except Exception as e:
            logger.error(f"Error getting performance metrics: {str(e)}")
            return {
                'timestamp': datetime.now().isoformat(),
                'error': str(e),
                'system_status': 'error'
            }
    
    def clear_caches(self):
        """Clear all performance caches"""
        self.get_shift_durations.cache_clear()
        self.get_employee_by_id.cache_clear()
        logger.info("Performance caches cleared")
    
    def __del__(self):
        """Cleanup on deletion"""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=False)

# Database optimization utilities
def optimize_database_indexes(db: Session):
    """Create performance indexes for large datasets"""
    try:
        # Essential indexes for 1000+ employees
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedules(date)",
            "CREATE INDEX IF NOT EXISTS idx_schedule_employee ON schedules(employee_id)",
            "CREATE INDEX IF NOT EXISTS idx_schedule_shift ON schedules(shift_id)",
            "CREATE INDEX IF NOT EXISTS idx_employee_department ON employees(department_id)",
            "CREATE INDEX IF NOT EXISTS idx_employee_weekly_off ON employees(weekly_off)",
            "CREATE INDEX IF NOT EXISTS idx_leave_date ON leaves(date)",
            "CREATE INDEX IF NOT EXISTS idx_leave_employee ON leaves(employee_id)",
            "CREATE INDEX IF NOT EXISTS idx_schedule_composite ON schedules(date, shift_id, employee_id)"
        ]
        
        for index_sql in indexes:
            db.execute(text(index_sql))
        
        db.commit()
        logger.info("Database indexes optimized for large-scale performance")
        
    except Exception as e:
        logger.error(f"Error optimizing database indexes: {str(e)}")
        db.rollback()

def setup_performance_monitoring():
    """Setup performance monitoring for the application"""
    try:
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('performance.log'),
                logging.StreamHandler()
            ]
        )
        logger.info("Performance monitoring initialized")
    except Exception as e:
        print(f"Error setting up performance monitoring: {str(e)}")

# Batch operations for large datasets
def batch_insert_schedules(db: Session, schedules: List[Dict], batch_size: int = 1000):
    """Optimized batch insert for large schedule datasets"""
    try:
        from database import Schedule
        
        total_inserted = 0
        for i in range(0, len(schedules), batch_size):
            batch = schedules[i:i + batch_size]
            
            # Create schedule objects
            schedule_objects = []
            for sched_data in batch:
                schedule_objects.append(Schedule(
                    date=sched_data['date'],
                    shift_id=sched_data['shift_id'],
                    employee_id=sched_data['employee_id'],
                    is_override=sched_data.get('is_override', False)
                ))
            
            # Bulk insert
            db.bulk_save_objects(schedule_objects)
            db.commit()
            
            total_inserted += len(batch)
            logger.info(f"Batch insert progress: {total_inserted}/{len(schedules)}")
        
        logger.info(f"Batch insert completed: {total_inserted} schedules")
        return total_inserted
        
    except Exception as e:
        logger.error(f"Error in batch insert: {str(e)}")
        db.rollback()
        return 0
