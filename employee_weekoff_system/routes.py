from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from models import db, AdminUser, Employee, Weekoff, SwapRequest
from utils import generate_ai_weekoffs, get_current_week_start
import datetime

bp = Blueprint('routes', __name__)

def login_required(role=None):
    def wrapper(f):
        def wrapped(*args, **kwargs):
            if 'user_id' not in session:
                return redirect(url_for('routes.login'))
            if role and session.get('role') != role:
                flash('Unauthorized access', 'danger')
                return redirect(url_for('routes.dashboard'))
            return f(*args, **kwargs)
        wrapped.__name__ = f.__name__
        return wrapped
    return wrapper

@bp.route('/')
def index():
    return redirect(url_for('routes.dashboard'))

@bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        role = request.form.get('role')
        
        if role == 'admin':
            user = AdminUser.query.filter_by(username=username).first()
            if user and user.check_password(password):
                session['user_id'] = user.id
                session['role'] = 'admin'
                session['username'] = user.username
                return redirect(url_for('routes.dashboard'))
        else:
            emp = Employee.query.filter_by(emp_id=username).first()
            if emp and emp.check_password(password):
                session['user_id'] = emp.id
                session['role'] = 'employee'
                session['username'] = emp.name
                return redirect(url_for('routes.dashboard'))
                
        flash('Invalid credentials', 'danger')
    return render_template('login.html')

@bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('routes.login'))

@bp.route('/dashboard')
@login_required()
def dashboard():
    week_start = get_current_week_start()
    weekoffs = Weekoff.query.filter_by(week_start_date=week_start).all()
    swaps = SwapRequest.query.all()
    
    total_off = len(weekoffs)
    
    dept_off_count = {}
    for w in weekoffs:
        dept = w.employee.team
        dept_off_count[dept] = dept_off_count.get(dept, 0) + 1
        
    replacement_employees = total_off
    
    return render_template('dashboard.html', weekoffs=weekoffs, swaps=swaps, week_start=week_start,
                           total_off=total_off, dept_off_count=dept_off_count,
                           replacement_employees=replacement_employees)

@bp.route('/generate_weekoffs', methods=['POST'])
@login_required('admin')
def api_generate_weekoffs():
    success, msg = generate_ai_weekoffs()
    flash(msg, 'success' if success else 'warning')
    return redirect(url_for('routes.dashboard'))

@bp.route('/employees', methods=['GET', 'POST'])
@login_required('admin')
def employees():
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'add':
            emp = Employee(
                emp_id=request.form.get('emp_id'),
                name=request.form.get('name'),
                team=request.form.get('team'),
                shift=request.form.get('shift'),
                email=request.form.get('email')
            )
            emp.set_password(request.form.get('password'))
            db.session.add(emp)
            db.session.commit()
            flash('Employee added', 'success')
        elif action == 'delete':
            emp_id = request.form.get('id')
            emp = Employee.query.get(emp_id)
            if emp:
                Weekoff.query.filter_by(employee_id=emp.id).delete()
                SwapRequest.query.filter((SwapRequest.requestor_id==emp.id) | (SwapRequest.target_id==emp.id)).delete()
                db.session.delete(emp)
                db.session.commit()
                flash('Employee deleted', 'success')
                
    employees = Employee.query.all()
    return render_template('employees.html', employees=employees)

@bp.route('/request_swap', methods=['POST'])
@login_required('employee')
def request_swap():
    target_id = request.form.get('target_id')
    requested_day = request.form.get('requested_day')
    target_day = request.form.get('target_day')
    week_start = get_current_week_start()
    
    swap = SwapRequest(
        requestor_id=session['user_id'],
        target_id=target_id,
        week_start_date=week_start,
        requested_day=requested_day,
        target_day=target_day
    )
    db.session.add(swap)
    db.session.commit()
    flash('Swap requested successfully', 'success')
    return redirect(url_for('routes.dashboard'))

@bp.route('/handle_swap/<int:swap_id>/<action>', methods=['POST'])
@login_required()
def handle_swap(swap_id, action):
    swap = SwapRequest.query.get_or_404(swap_id)
    if session['role'] == 'employee' and swap.target_id == session['user_id']:
        if action == 'accept':
            swap.status = 'Accepted'
        elif action == 'reject':
            swap.status = 'Rejected'
            
    elif session['role'] == 'admin' and swap.status == 'Accepted':
        if action == 'approve':
            swap.status = 'Admin_Approved'
            # Actual swap update
            w1 = Weekoff.query.filter_by(employee_id=swap.requestor_id, week_start_date=swap.week_start_date).first()
            w2 = Weekoff.query.filter_by(employee_id=swap.target_id, week_start_date=swap.week_start_date).first()
            if w1 and w2:
                w1.weekoff_day, w2.weekoff_day = w2.weekoff_day, w1.weekoff_day
        elif action == 'reject':
            swap.status = 'Rejected'
            
    db.session.commit()
    flash(f'Swap {action}ed', 'success')
    return redirect(url_for('routes.dashboard'))
