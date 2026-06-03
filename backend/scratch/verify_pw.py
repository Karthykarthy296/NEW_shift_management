import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.database import SessionLocal, User
from app.middleware.auth import verify_password

def verify():
    db = SessionLocal()
    users = db.query(User).all()
    passwords_to_test = ['admin', 'admin123', 'manager', 'supervisor', 'password', 'the ghost', 'karthy']
    for u in users:
        print(f"User: {u.username} (Role: {u.role})")
        matched = False
        for pw in passwords_to_test:
            if verify_password(pw, u.password_hash):
                print(f"  -> Match found! Password is: '{pw}'")
                matched = True
                break
        if not matched:
            print("  -> No match found in test list.")
    db.close()

if __name__ == '__main__':
    verify()
