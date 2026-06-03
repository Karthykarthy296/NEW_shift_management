import sys
import os
from datetime import date

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.database import SessionLocal, Schedule
from app.services.ai_scheduler import generate_ai_schedule

def run_test():
    print("Starting AI Scheduler test with Gemini Integration...")
    db = SessionLocal()
    try:
        # Check initial schedule count
        target_date = date.today().isoformat()
        initial_count = db.query(Schedule).filter(Schedule.date == target_date).count()
        print(f"Initial schedules for {target_date}: {initial_count}")
        
        # Temporarily unset GEMINI_API_KEY to test graceful fallback
        old_api_key = os.environ.get("GEMINI_API_KEY")
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]
            
        print("\n--- Running with GEMINI_API_KEY unset (Graceful Fallback Test) ---")
        generate_ai_schedule(db, target_date=target_date, force_refresh=True)
        fallback_count = db.query(Schedule).filter(Schedule.date == target_date).count()
        print(f"Schedules after fallback generation: {fallback_count}")
        
        # Restore API key if it was set
        if old_api_key:
            os.environ["GEMINI_API_KEY"] = old_api_key
            print("\n--- Running with GEMINI_API_KEY set (API call integration check) ---")
            generate_ai_schedule(db, target_date=target_date, force_refresh=True)
            active_count = db.query(Schedule).filter(Schedule.date == target_date).count()
            print(f"Schedules after Gemini generation: {active_count}")
            
    except Exception as e:
        print("Scheduler run failed:", e)
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    run_test()
