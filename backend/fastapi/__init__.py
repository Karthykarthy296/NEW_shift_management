import inspect
import re
import asyncio
import flask
from flask import Flask, request, jsonify, g, make_response
from werkzeug.datastructures import FileStorage
from starlette.requests import Request


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str = None):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)

class Depends:
    def __init__(self, dependency):
        self.dependency = dependency

def Query(default=..., **kwargs):
    return default

def File(default=..., **kwargs):
    return default

class UploadFile:
    def __init__(self, file_storage: FileStorage):
        self.file = file_storage.stream
        self.filename = file_storage.filename
        self.content_type = file_storage.content_type

class BackgroundTasks:
    def __init__(self):
        self.tasks = []

    def add_task(self, func, *args, **kwargs):
        self.tasks.append((func, args, kwargs))

    def run_all(self):
        import threading
        for func, args, kwargs in self.tasks:
            t = threading.Thread(target=func, args=args, kwargs=kwargs)
            t.start()

# Status codes
class StatusCodes:
    HTTP_200_OK = 200
    HTTP_201_CREATED = 201
    HTTP_202_ACCEPTED = 202
    HTTP_204_NO_CONTENT = 204
    HTTP_400_BAD_REQUEST = 400
    HTTP_401_UNAUTHORIZED = 401
    HTTP_403_FORBIDDEN = 403
    HTTP_404_NOT_FOUND = 404
    HTTP_405_METHOD_NOT_ALLOWED = 405
    HTTP_500_INTERNAL_SERVER_ERROR = 500

status = StatusCodes()

def to_jsonable(obj):
    if isinstance(obj, list):
        return [to_jsonable(x) for x in obj]
    if isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}
    if hasattr(obj, '__table__'):
        return {col.name: to_jsonable(getattr(obj, col.name)) for col in obj.__table__.columns}
    if hasattr(obj, 'dict'):
        return to_jsonable(obj.dict())
    if hasattr(obj, 'model_dump'):
        return to_jsonable(obj.model_dump())
    return obj

class MockStarletteRequest:
    def __init__(self, flask_req):
        self.url = type('URL', (), {'path': flask_req.path})()
        self.method = flask_req.method
        self.headers = flask_req.headers
        self.client = type('Client', (), {'host': flask_req.remote_addr})()

class MockStarletteResponse:
    def __init__(self, raw_response):
        self.raw_response = raw_response
        if hasattr(raw_response, 'status_code'):
            self.status_code = raw_response.status_code
        elif isinstance(raw_response, tuple) and len(raw_response) > 1 and isinstance(raw_response[1], int):
            self.status_code = raw_response[1]
        else:
            self.status_code = 200

    def unwrap(self):
        return self.raw_response

async def handle_request_with_middlewares(flask_request, route_func, route_args, route_kwargs, middlewares):
    async def final_call_next(req):
        if inspect.iscoroutinefunction(route_func):
            res = await route_func(*route_args, **route_kwargs)
        else:
            res = route_func(*route_args, **route_kwargs)
        return MockStarletteResponse(res)

    current_call_next = final_call_next
    for mw_class, mw_args, mw_kwargs in reversed(middlewares):
        mw_instance = mw_class(app=None, *mw_args, **mw_kwargs)
        def make_call_next(dispatcher, prev_call_next):
            async def call_next(req):
                return await dispatcher(req, prev_call_next)
            return call_next
        current_call_next = make_call_next(mw_instance.dispatch, current_call_next)

    starlette_req = MockStarletteRequest(flask_request)
    starlette_res = await current_call_next(starlette_req)
    return starlette_res.unwrap()

class FastAPI:
    def __init__(self, **kwargs):
        self.flask_app = Flask("fastapi_to_flask")
        self.flask_app.config['JSON_AS_ASCII'] = False
        self.routers = []
        self.middlewares = []
        self.startup_funcs = []
        
        @self.flask_app.after_request
        def after_request(response):
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', '*')
            response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH')
            return response
            
        @self.flask_app.errorhandler(HTTPException)
        def handle_http_exception(e):
            return jsonify({"detail": e.detail}), e.status_code

        @self.flask_app.errorhandler(Exception)
        def handle_generic_exception(e):
            import traceback
            traceback.print_exc()
            return jsonify({"detail": str(e)}), 500
            
        @self.flask_app.teardown_request
        def teardown_request(exception=None):
            if hasattr(g, '_generators'):
                for gen in g._generators:
                    try:
                        next(gen)
                    except StopIteration:
                        pass
                    except Exception:
                        pass

    def add_middleware(self, middleware_class, *args, **kwargs):
        if "CORSMiddleware" in str(middleware_class) or "CORSMiddleware" in middleware_class.__name__:
            return
        self.middlewares.append((middleware_class, args, kwargs))

    def include_router(self, router):
        self.routers.append(router)
        router.register(self)

    def on_event(self, event_type: str):
        def decorator(func):
            if event_type == "startup":
                self.startup_funcs.append(func)
            return func
        return decorator

    def middleware(self, middleware_type: str):
        def decorator(func):
            # Ignore HTTP middleware as Flask handles CORS and error formatting natively
            return func
        return decorator


    def get(self, path, **kwargs): return self.route(path, "GET", **kwargs)
    def post(self, path, **kwargs): return self.route(path, "POST", **kwargs)
    def put(self, path, **kwargs): return self.route(path, "PUT", **kwargs)
    def delete(self, path, **kwargs): return self.route(path, "DELETE", **kwargs)
    def patch(self, path, **kwargs): return self.route(path, "PATCH", **kwargs)

    def route(self, path, method, **kwargs):
        def decorator(func):
            self.register_route(self.flask_app, path, method, func)
            return func
        return decorator

    def resolve_dependency(self, depends_obj):
        dep_func = depends_obj.dependency
        sig = inspect.signature(dep_func)
        dep_args = {}
        for param_name, param in sig.parameters.items():
            if isinstance(param.default, Depends):
                dep_args[param_name] = self.resolve_dependency(param.default)
            elif param.annotation == flask.Request or param_name == "request":
                dep_args[param_name] = request


        
        if hasattr(dep_func, '__call__') and dep_func.__class__.__name__ == "HTTPBearer":
            return dep_func()
            
        if inspect.isgeneratorfunction(dep_func):
            gen = dep_func(**dep_args)
            val = next(gen)
            if not hasattr(g, '_generators'):
                g._generators = []
            g._generators.append(gen)
            return val
        elif inspect.iscoroutinefunction(dep_func):
            return asyncio.run(dep_func(**dep_args))
        else:
            return dep_func(**dep_args)

    def register_route(self, flask_app, path, method, func, router_dependencies=None):
        flask_path = re.sub(r'\{([^}]+)\}', r'<\1>', path)
        handler_name = f"{func.__name__}_{method}_{path.replace('/', '_').replace('{', '').replace('}', '')}"
        
        @flask_app.route(flask_path, methods=[method, "OPTIONS"], endpoint=handler_name)
        def flask_handler(*args, **kwargs):
            if request.method == "OPTIONS":
                return make_response("", 200)

            sig = inspect.signature(func)
            bound_args = {}
            bg_tasks = None

            try:
                if router_dependencies:
                    for dep in router_dependencies:
                        self.resolve_dependency(dep)

                for param_name, param in sig.parameters.items():
                    if param.annotation == BackgroundTasks:
                        bg_tasks = BackgroundTasks()
                        bound_args[param_name] = bg_tasks
                        continue
                    
                    if isinstance(param.default, Depends):
                        bound_args[param_name] = self.resolve_dependency(param.default)
                        continue
                    
                    if param_name in kwargs:
                        val = kwargs[param_name]
                        if param.annotation != inspect.Parameter.empty:
                            try:
                                val = param.annotation(val)
                            except Exception:
                                pass
                        bound_args[param_name] = val
                        continue
                    
                    if param.annotation == UploadFile or param.default == File(...):
                        file_storage = request.files.get(param_name)
                        if file_storage:
                            bound_args[param_name] = UploadFile(file_storage)
                        else:
                            bound_args[param_name] = None
                        continue
                    
                    if param_name == "request":
                        bound_args[param_name] = request
                        continue

                    is_primitive = param.annotation in (str, int, float, bool, type(None)) or param.annotation == inspect.Parameter.empty
                    if not is_primitive:
                        body_data = request.get_json(silent=True) or {}
                        if hasattr(param.annotation, "parse_obj") or hasattr(param.annotation, "__fields__"):
                            try:
                                bound_args[param_name] = param.annotation(**body_data)
                            except Exception as e:
                                raise HTTPException(400, f"Validation error: {str(e)}")
                        else:
                            bound_args[param_name] = body_data
                        continue

                    if param_name in request.args:
                        val = request.args.get(param_name)
                        if param.annotation == int:
                            val = int(val)
                        elif param.annotation == float:
                            val = float(val)
                        elif param.annotation == bool:
                            val = val.lower() in ('true', '1', 'yes')
                        bound_args[param_name] = val
                    else:
                        if param.default != inspect.Parameter.empty:
                            bound_args[param_name] = param.default
                        else:
                            bound_args[param_name] = None

                if self.middlewares:
                    async def run_mw():
                        return await handle_request_with_middlewares(request, func, args, bound_args, self.middlewares)
                    res = asyncio.run(run_mw())
                else:
                    if inspect.iscoroutinefunction(func):
                        res = asyncio.run(func(*args, **bound_args))
                    else:
                        res = func(*args, **bound_args)

            except HTTPException as he:
                raise he
            except Exception as e:
                raise HTTPException(500, str(e))

            if bg_tasks:
                bg_tasks.run_all()

            return self.process_response(res)


    def process_response(self, res):
        if isinstance(res, tuple):
            body, status_code = res
            return make_response(self.process_response(body), status_code)

        from flask import Response as FlaskResponse
        if isinstance(res, (FlaskResponse, flask.wrappers.Response)):
            return res

        if hasattr(res, 'unwrap'):
            return res.unwrap()
            
        if hasattr(res, 'dict'):
            return jsonify(to_jsonable(res.dict()))
        if hasattr(res, 'model_dump'):
            return jsonify(to_jsonable(res.model_dump()))
            
        if isinstance(res, (dict, list)):
            return jsonify(to_jsonable(res))
            
        if isinstance(res, str):
            return make_response(res)
            
        return res

    def __call__(self, environ, start_response):
        if not hasattr(self, '_startup_run'):
            self._startup_run = True
            for func in self.startup_funcs:
                if inspect.iscoroutinefunction(func):
                    asyncio.run(func())
                else:
                    func()
        return self.flask_app(environ, start_response)

class APIRouter:
    def __init__(self, prefix="", tags=None, dependencies=None, **kwargs):
        self.prefix = prefix
        self.dependencies = dependencies or []
        self.routes = []

    def get(self, path, **kwargs): return self.route(path, "GET", **kwargs)
    def post(self, path, **kwargs): return self.route(path, "POST", **kwargs)
    def put(self, path, **kwargs): return self.route(path, "PUT", **kwargs)
    def delete(self, path, **kwargs): return self.route(path, "DELETE", **kwargs)
    def patch(self, path, **kwargs): return self.route(path, "PATCH", **kwargs)

    def route(self, path, method, **kwargs):
        def decorator(func):
            self.routes.append((path, method, func))
            return func
        return decorator

    def register(self, app):
        for path, method, func in self.routes:
            full_path = self.prefix + path
            app.register_route(app.flask_app, full_path, method, func, router_dependencies=self.dependencies)
