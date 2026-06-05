from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.database.database import SessionLocal, User
from app.middleware import auth
from app.utils.activity_logger import log_activity
import traceback
import logging

logger = logging.getLogger("ActivityMiddleware")

class ActivityLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith(("/docs", "/openapi.json", "/redoc", "/favicon.ico", "/static")):
            return await call_next(request)

        # Extract IP and User-Agent
        ip_address = request.client.host if request.client else None
        device_info = request.headers.get("user-agent")

        # Check authorization token from header
        auth_header = request.headers.get("authorization")
        username = None
        user_id = None
        role = None

        if auth_header and auth_header.startswith("Bearer "):
            try:
                token = auth_header.split(" ")[1]
                payload = auth.decode_access_token(token)
                if payload:
                    username = payload.get("sub")
                    role = payload.get("role")
            except Exception:
                pass

        db = SessionLocal()
        try:
            response = await call_next(request)

            # Auto-log non-2xx failures (e.g. Unauthorized, Forbidden, Server Errors)
            status_code = response.status_code
            if status_code >= 400:
                status_str = "failed"
                if status_code == 401:
                    activity = "Unauthorized Access"
                    module = "System"
                    desc = f"Attempted unauthorized access to {path}"
                elif status_code == 403:
                    activity = "Forbidden Access"
                    module = "System"
                    desc = f"Role '{role}' attempted access to {path}"
                elif status_code >= 500:
                    activity = "Server Error"
                    module = "System"
                    desc = f"Server returned 500 for {request.method} {path}"
                else:
                    activity = "API Failure"
                    module = "System"
                    desc = f"API returned status {status_code} for {request.method} {path}"

                await log_activity(
                    db=db,
                    activity=activity,
                    module_name=module,
                    status=status_str,
                    description=desc,
                    user_id=user_id,
                    username=username,
                    role=role,
                    ip_address=ip_address,
                    device_info=device_info
                )
            
            return response

        except Exception as e:
            logger.error(f"Middleware Exception: {e}")
            try:
                await log_activity(
                    db=db,
                    activity="Server Error",
                    module_name="System",
                    status="failed",
                    description=f"Unhandled exception on {request.method} {path}: {str(e)}",
                    user_id=user_id,
                    username=username,
                    role=role,
                    ip_address=ip_address,
                    device_info=device_info
                )
            except Exception as log_ex:
                logger.error(f"Could not log middleware exception: {log_ex}")

            raise e
        finally:
            db.close()
