from database import SessionLocal, Employee

db = SessionLocal()
emps = db.query(Employee).all()
print(f'Total employees: {len(emps)}')
if emps:
    print(f'Sample: {emps[0].emp_id} - {emps[0].name}')
    print(f'Department: {emps[0].department.name if emps[0].department else "None"}')
    print(f'Skills: {emps[0].skills}')
    print(f'Weekly Off: {emps[0].weekly_off}')
db.close()
