from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from app.database.database import SessionLocal, User
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

auth_router = APIRouter(tags=["Authentication"])

@auth_router.post("/login")
async def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not auth.verify_password(user.password, db_user.password_hash):
        await log_activity(
            db=db,
            activity="Failed Login Attempt",
            module_name="Authentication",
            status="failed",
            description=f"Failed login attempt for username: {user.username}"
        )
        raise HTTPException(status_code=400, detail="Incorrect credentials")
    access_token = auth.create_access_token(data={"sub": db_user.username, "role": db_user.role})
    await log_activity(
        db=db,
        activity="User Login",
        module_name="Authentication",
        status="success",
        description=f"User {db_user.username} logged in successfully",
        user_id=db_user.id,
        username=db_user.username,
        role=db_user.role
    )
    return {"access_token": access_token, "token_type": "bearer", "role": db_user.role}

@auth_router.post("/register")
async def register(user: schemas.UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_pwd = auth.get_password_hash(user.password)
    new_user = User(username=user.username, name=user.name, password_hash=hashed_pwd, role=user.role)
    db.add(new_user)
    db.commit()
    await log_activity(
        db=db,
        activity="User Created",
        module_name="Admin",
        status="success",
        description=f"New user registered: {user.username} ({user.role})",
        username=user.username,
        role=user.role
    )
    return {"msg": "Registration successful"}

@auth_router.post("/create-user")
async def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["admin"]))):
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_pwd = auth.get_password_hash(user.password)
    new_user = User(username=user.username, password_hash=hashed_pwd, role=user.role)
    db.add(new_user)
    db.commit()
    await log_activity(
        db=db,
        activity="User Created",
        module_name="Admin",
        status="success",
        description=f"Admin created user: {user.username} ({user.role})",
        user_id=current_user.id,
        username=current_user.username,
        role=current_user.role
    )
    return {"msg": f"User {user.username} created successfully"}

@auth_router.get("/users")
def get_users(db: Session = Depends(get_db), current_user: User = Depends(require_role(["admin"]))):
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username, "role": u.role} for u in users]

@auth_router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["admin"]))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    target_username = user.username
    db.delete(user)
    db.commit()
    await log_activity(
        db=db,
        activity="User Deleted",
        module_name="Admin",
        status="success",
        description=f"Admin deleted user: {target_username}",
        user_id=current_user.id,
        username=current_user.username,
        role=current_user.role
    )
    return {"msg": "User deleted successfully"}
