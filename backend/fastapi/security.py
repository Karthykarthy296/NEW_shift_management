import flask
from fastapi import HTTPException

class HTTPAuthorizationCredentials:
    def __init__(self, scheme: str, credentials: str):
        self.scheme = scheme
        self.credentials = credentials

class HTTPBearer:
    def __init__(self, auto_error: bool = True):
        self.auto_error = auto_error

    def __call__(self):
        auth_header = flask.request.headers.get("Authorization")
        if not auth_header:
            if self.auto_error:
                raise HTTPException(status_code=401, detail="Not authenticated")
            return None
        
        parts = auth_header.split(" ")
        if len(parts) != 2 or parts[0].lower() != "bearer":
            if self.auto_error:
                raise HTTPException(status_code=401, detail="Invalid auth header")
            return None
            
        return HTTPAuthorizationCredentials(scheme="bearer", credentials=parts[1])
