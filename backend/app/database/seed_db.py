from app.database.database import SessionLocal, User, engine, Base
from app.middleware.auth import get_password_hash

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    db.commit()
    db.close()
    print("Seeding complete.")

if __name__ == "__main__":
    seed()
