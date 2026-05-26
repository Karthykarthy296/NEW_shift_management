import urllib.request, json, urllib.parse, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = 'http://127.0.0.1:8000'
d = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
req = urllib.request.Request(f'{BASE}/login', data=d, headers={'Content-Type': 'application/json'})
tok = json.loads(urllib.request.urlopen(req).read())['access_token']
H = {'Authorization': 'Bearer ' + tok}

# Get all departments
req2 = urllib.request.Request(f'{BASE}/departments', headers=H)
depts = json.loads(urllib.request.urlopen(req2).read())

# Get all employees and group by department
req3 = urllib.request.Request(f'{BASE}/employees', headers=H)
all_emps = json.loads(urllib.request.urlopen(req3).read())

from collections import Counter
dept_counts = Counter(e.get('department', 'Unknown') for e in all_emps)
print('Department distribution in employee records:')
for dept, count in dept_counts.most_common(15):
    print(f'  {dept}: {count}')
print(f'\nTotal employees: {len(all_emps)}')
print(f'Total departments (from /departments): {len(depts)}')
print('Department names from /departments:', [d.get("name") for d in depts])
