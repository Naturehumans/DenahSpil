import urllib.request
import json

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/auth/login', 
    data=b'{"username":"admin","password":"admin123"}', 
    headers={'Content-Type': 'application/json'}
)
res = urllib.request.urlopen(req)
token = json.loads(res.read())['access_token']

req2 = urllib.request.Request(
    'http://127.0.0.1:8000/api/auth/me', 
    headers={'Authorization': 'Bearer ' + token}
)
try:
    print(urllib.request.urlopen(req2).read().decode())
except Exception as e:
    print(e.read().decode() if hasattr(e, 'read') else str(e))
