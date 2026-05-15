from database import SessionLocal, Employee
db = SessionLocal()
roles = db.query(Employee.role).distinct().all()
print("Unique roles in database:")
for role in roles:
    print(f"- {role[0]}")
db.close()
