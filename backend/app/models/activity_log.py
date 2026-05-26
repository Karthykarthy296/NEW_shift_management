from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ActivityLogBase(BaseModel):
    activity: str
    module_name: str
    description: Optional[str] = None
    status: str
    ip_address: Optional[str] = None
    device_info: Optional[str] = None

class ActivityLogCreate(ActivityLogBase):
    user_id: Optional[int] = None
    username: Optional[str] = None
    role: Optional[str] = None

class ActivityLogResponse(ActivityLogBase):
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    role: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True
