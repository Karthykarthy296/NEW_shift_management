from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database.database import ActivityLog
from datetime import datetime
from typing import Optional

class ActivityLogService:
    @staticmethod
    def get_logs(
        db: Session,
        page: int = 1,
        limit: int = 50,
        search: Optional[str] = None,
        module_name: Optional[str] = None,
        role: Optional[str] = None,
        activity: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        user_id: Optional[int] = None
    ):
        query = db.query(ActivityLog)

        # Filters
        if user_id is not None:
            query = query.filter(ActivityLog.user_id == user_id)

        if module_name:
            query = query.filter(ActivityLog.module_name == module_name)

        if role:
            query = query.filter(ActivityLog.role == role)

        if activity:
            query = query.filter(ActivityLog.activity == activity)

        if status:
            query = query.filter(ActivityLog.status == status)

        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    ActivityLog.username.like(search_filter),
                    ActivityLog.activity.like(search_filter),
                    ActivityLog.description.like(search_filter)
                )
            )

        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.filter(ActivityLog.created_at >= start_dt)
            except ValueError:
                pass

        if end_date:
            try:
                end_dt = datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
                query = query.filter(ActivityLog.created_at <= end_dt)
            except ValueError:
                pass

        # Sort: latest first
        query = query.order_by(ActivityLog.created_at.desc())

        # Pagination
        total = query.count()
        offset = (page - 1) * limit
        logs = query.offset(offset).limit(limit).all()

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "logs": logs
        }
