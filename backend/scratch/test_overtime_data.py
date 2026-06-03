import urllib.request
import json

def test_overtime_data():
    # 1. Login
    login_data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode('utf-8')
    req = urllib.request.Request(
        'http://127.0.0.1:8000/login',
        data=login_data,
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            res_body = json.loads(response.read().decode('utf-8'))
            token = res_body['access_token']
    except Exception as e:
        print("Login failed:", e)
        return

    # 2. Query Overtime API
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    req = urllib.request.Request(
        'http://127.0.0.1:8000/overtime',
        headers=headers,
        method='GET'
    )
    try:
        with urllib.request.urlopen(req) as response:
            res_body = json.loads(response.read().decode('utf-8'))
            print("Response:", json.dumps(res_body, indent=2))
    except Exception as e:
        print("Failed to fetch /overtime:", e)

if __name__ == '__main__':
    test_overtime_data()
