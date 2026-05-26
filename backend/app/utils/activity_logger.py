import logging
from typing import Optional
from app.database.database import ActivityLog

# Set up logging
logger = logging.getLogger("ActivityLogger")

async def log_activity(
    db,
    activity: str,
    module_name: str,
    status: str,
    description: Optional[str] = None,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    role: Optional[str] = None,
    ip_address: Optional[str] = None,
    device_info: Optional[str] = None
) -> Optional[ActivityLog]:
    try:
        log_entry = ActivityLog(
            user_id=user_id,
            username=username,
            role=role,
            activity=activity,
            module_name=module_name,
            description=description,
            status=status,
            ip_address=ip_address,
            device_info=device_info
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        logger.error(f"Activity Log Error: {e}")
        return None
