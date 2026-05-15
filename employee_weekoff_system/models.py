from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import datetime

db = SQLAlchemy()

class AdminUser(db.Model):
    __tablename__ = 'admin_users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(100), unique=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Employee(db.Model):
    __tablename__ = 'employees'
    id = db.Column(db.Integer, primary_key=True)
    emp_id = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    team = db.Column(db.String(50), nullable=False)
    shift = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Weekoff(db.Model):
    __tablename__ = 'weekoffs'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    week_start_date = db.Column(db.Date, nullable=False)
    weekoff_day = db.Column(db.String(15), nullable=False)
    
    employee = db.relationship('Employee', backref='weekoffs')

class SwapRequest(db.Model):
    __tablename__ = 'swap_requests'
    id = db.Column(db.Integer, primary_key=True)
    requestor_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    target_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    week_start_date = db.Column(db.Date, nullable=False)
    requested_day = db.Column(db.String(15), nullable=False)
    target_day = db.Column(db.String(15), nullable=False)
    status = db.Column(db.String(20), default='Pending') # Pending, Accepted, Rejected, Admin_Approved
    
    requestor = db.relationship('Employee', foreign_keys=[requestor_id])
    target = db.relationship('Employee', foreign_keys=[target_id])
