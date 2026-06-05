from app.database.database import SessionLocal
from app.routes.schedule_routes import get_4_week_schedule
import time

db = SessionLocal()
start = time.time()
try:
    res = get_4_week_schedule(None, db)
    print("Success, length of weeks:", len(res['weeks']))
except Exception as e:
    print("Error:", e)
end = time.time()
print(f"Time taken: {end - start} seconds")
