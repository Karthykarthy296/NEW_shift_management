from apscheduler.schedulers.background import BackgroundScheduler
from app.services.services import generate_weekoffs, get_current_week_start
import datetime

scheduler = BackgroundScheduler()

def weekly_rotation_job():
    # Runs automatically to generate weekoffs for the NEXT week
    next_week = get_current_week_start() + datetime.timedelta(days=7)
    # Using app context is required if touching DB
    from app import app
    with app.app_context():
        success, msg = generate_weekoffs(next_week)
        print(f"[Scheduler] Weekly rotation: {msg}")

def start_scheduler():
    # Run every Sunday at 23:59 to generate for the next week
    scheduler.add_job(weekly_rotation_job, 'cron', day_of_week='sun', hour=23, minute=59)
    scheduler.start()
    print("[Scheduler] Started background scheduling.")
