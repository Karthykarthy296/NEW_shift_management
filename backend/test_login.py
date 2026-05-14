import urllib.request, json

req = urllib.request.Request(
    'http://127.0.0.1:8000/login', 
    data=json.dumps({'username':'admin','password':'admin123'}).encode('utf-8'), 
    headers={'Content-Type': 'application/json'}
)
try: 
    res = urllib.request.urlopen(req)
    print(res.read())
except Exception as e: 
    print(e.read())
