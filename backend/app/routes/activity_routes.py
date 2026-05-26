from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from app.database.database import SessionLocal, User
from app.middleware import auth
from app.services.activity_service import ActivityLogService

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

router = APIRouter(prefix="/activity-logs", tags=["Activity Logs"])

@router.get("")
def get_all_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    module_name: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    activity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager"]))
):
    return ActivityLogService.get_logs(
        db=db,
        page=page,
        limit=limit,
        search=search,
        module_name=module_name,
        role=role,
        activity=activity,
        status=status,
        start_date=start_date,
        end_date=end_date
    )

@router.get("/user/{user_id}")
def get_user_logs(
    user_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager"]))
):
    return ActivityLogService.get_logs(
        db=db,
        page=page,
        limit=limit,
        user_id=user_id
    )

@router.get("/module/{module_name}")
def get_module_logs(
    module_name: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager"]))
):
    return ActivityLogService.get_logs(
        db=db,
        page=page,
        limit=limit,
        module_name=module_name
    )
