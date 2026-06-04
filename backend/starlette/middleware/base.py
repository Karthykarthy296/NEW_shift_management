class BaseHTTPMiddleware:
    def __init__(self, app, **kwargs):
        self.app = app
