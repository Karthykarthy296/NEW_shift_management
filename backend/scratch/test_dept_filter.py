import urllib.request, json, urllib.parse, sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = 'http://127.0.0.1:8000'

# Login
d = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
req = urllib.request.Request(f'{BASE}/login', data=d, headers={'Content-Type': 'application/json'})
tok = json.loads(urllib.request.urlopen(req).read())['access_token']
H = {'Authorization': 'Bearer ' + tok}
print('[OK] Login success')

# GET /departments
req2 = urllib.request.Request(f'{BASE}/departments', headers=H)
depts = json.loads(urllib.request.urlopen(req2).read())
names = [d.get('name', '?') for d in depts[:6]]
print(f'[OK] GET /departments => {len(depts)} departments')
print(f'     Sample: {names}')

# GET /employees (no filter)
req3 = urllib.request.Request(f'{BASE}/employees', headers=H)
all_emps = json.loads(urllib.request.urlopen(req3).read())
print(f'[OK] GET /employees => {len(all_emps)} employees total')

# GET /employees?department=<first dept>
if depts:
    dept_name = depts[0].get('name', '')
    url = f'{BASE}/employees?department={urllib.parse.quote(dept_name)}'
    req4 = urllib.request.Request(url, headers=H)
    dept_emps = json.loads(urllib.request.urlopen(req4).read())
    print(f'[OK] GET /employees?department={dept_name} => {len(dept_emps)} employees')
    if dept_emps:
        e = dept_emps[0]
        print(f'     Sample: name={e["name"]}, dept={e["department"]}, emp_id={e["emp_id"]}')
