import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.database import SessionLocal, User, engine

def check_db():
    print("Testing connection...")
    print("Database bind engine URL:", engine.url)
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"Found {len(users)} users:")
        for u in users:
            print(f"- ID: {u.id}, Username: {u.username}, Name: {u.name}, Role: {u.role}")
    except Exception as e:
        print("Error reading users:", e)
    finally:
        db.close()

if __name__ == '__main__':
    check_db()
