import urllib.request
import json

def test_apis():
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
            print("Successfully logged in. Token acquired.")
    except Exception as e:
        print("Login failed:", e)
        return

    # 2. Query Overtime API
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    endpoints = [
        ('/overtime', 'GET'),
        ('/overtime/stats', 'GET'),
        ('/employees', 'GET'),
        ('/reports/leave-stats', 'GET'),
        ('/reports/ai-metrics', 'GET'),
        ('/reports/department-coverage', 'GET'),
        ('/reports/replacement-history', 'GET')
    ]

    for endpoint, method in endpoints:
        req = urllib.request.Request(
            f'http://127.0.0.1:8000{endpoint}',
            headers=headers,
            method=method
        )
        try:
            with urllib.request.urlopen(req) as response:
                res_body = json.loads(response.read().decode('utf-8'))
                status_code = response.getcode()
                print(f"{method} {endpoint} -> Status: {status_code}, Keys: {list(res_body.keys()) if isinstance(res_body, dict) else 'List length: ' + str(len(res_body))}")
        except Exception as e:
            print(f"Failed to fetch {endpoint}: {e}")

if __name__ == '__main__':
    test_apis()
