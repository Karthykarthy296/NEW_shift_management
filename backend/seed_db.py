from database import SessionLocal, User, engine, Base
from auth import get_password_hash

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check for admin
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        print("Creating admin user...")
        db.add(User(username="admin", password_hash=get_password_hash("admin123"), role="admin"))
    else:
        print("Admin user already exists. Updating password...")
        admin.password_hash = get_password_hash("admin123")
    
    # Check for manager
    manager = db.query(User).filter(User.username == "manager").first()
    if not manager:
        print("Creating manager user...")
        db.add(User(username="manager", password_hash=get_password_hash("manager123"), role="manager"))
    
    # Check for supervisor
    supervisor = db.query(User).filter(User.username == "supervisor").first()
    if not supervisor:
        print("Creating supervisor user...")
        db.add(User(username="supervisor", password_hash=get_password_hash("supervisor123"), role="supervisor"))
    
    db.commit()
    db.close()
    print("Seeding complete.")

if __name__ == "__main__":
    seed()
