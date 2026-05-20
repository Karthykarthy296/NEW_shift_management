from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import db, User, Employee, Weekoff, SwapRequest
from services import generate_weekoffs, get_current_week_start

bp = Blueprint('api', __name__)

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        access_token = create_access_token(identity={'id': user.id, 'role': user.role, 'username': user.username})
        return jsonify({'access_token': access_token, 'role': user.role}), 200
    return jsonify({'msg': 'Bad username or password'}), 401

@bp.route('/employees', methods=['POST'])
@jwt_required()
def add_employee():
    current_user = get_jwt_identity()
    if current_user['role'] != 'admin':
        return jsonify({'msg': 'Admin access required'}), 403
        
    data = request.get_json()
    
    # Create User account for employee
    user = User(username=data['emp_id'], role='employee')
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    emp = Employee(
        emp_id=data['emp_id'],
        user_id=user.id,
        name=data['name'],
        email=data['email'],
        team=data['team'],
        shift=data['shift']
    )
    db.session.add(emp)
    db.session.commit()
    
    return jsonify({'msg': 'Employee created successfully'}), 201

@bp.route('/employees', methods=['GET'])
@jwt_required()
def get_employees():
    employees = Employee.query.all()
    res = [{'id': e.id, 'emp_id': e.emp_id, 'name': e.name, 'team': e.team, 'shift': e.shift} for e in employees]
    return jsonify(res), 200

@bp.route('/generate_weekoffs', methods=['POST'])
@jwt_required()
def trigger_weekoffs():
    current_user = get_jwt_identity()
    if current_user['role'] != 'admin':
        return jsonify({'msg': 'Admin access required'}), 403
        
    success, msg = generate_weekoffs()
    return jsonify({'msg': msg}), 200 if success else 400

@bp.route('/swap_request', methods=['POST'])
@jwt_required()
def request_swap():
    current_user = get_jwt_identity()
    if current_user['role'] != 'employee':
        return jsonify({'msg': 'Employee access required'}), 403
        
    data = request.get_json()
    emp = Employee.query.filter_by(user_id=current_user['id']).first()
    
    swap = SwapRequest(
        requestor_id=emp.id,
        target_id=data['target_id'],
        week_start_date=get_current_week_start(),
        requested_day=data['requested_day'],
        target_day=data['target_day']
    )
    db.session.add(swap)
    db.session.commit()
    return jsonify({'msg': 'Swap requested'}), 201

@bp.route('/swap_approve/<int:swap_id>', methods=['POST'])
@jwt_required()
def approve_swap(swap_id):
    current_user = get_jwt_identity()
    swap = SwapRequest.query.get(swap_id)
    if not swap:
        return jsonify({'msg': 'Not found'}), 404
        
    # Example simple logic for admin approval
    if current_user['role'] == 'admin':
        swap.status = 'Admin_Approved'
        # Swap weekoff days in DB
        w1 = Weekoff.query.filter_by(employee_id=swap.requestor_id, week_start_date=swap.week_start_date).first()
        w2 = Weekoff.query.filter_by(employee_id=swap.target_id, week_start_date=swap.week_start_date).first()
        if w1 and w2:
            w1.weekoff_day, w2.weekoff_day = w2.weekoff_day, w1.weekoff_day
        db.session.commit()
        return jsonify({'msg': 'Swap approved and applied'}), 200
        
    return jsonify({'msg': 'Unauthorized'}), 403
