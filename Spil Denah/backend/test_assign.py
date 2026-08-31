import urllib.request
import json

# 1. Login
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/auth/login', 
    data=b'{"username":"admin","password":"admin123"}', 
    headers={'Content-Type': 'application/json'}
)
res = urllib.request.urlopen(req)
token = json.loads(res.read())['access_token']
headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}

# 2. Get buildings
req_b = urllib.request.Request('http://127.0.0.1:8000/api/buildings', headers=headers)
buildings = json.loads(urllib.request.urlopen(req_b).read())
print("Buildings:", buildings)

if not buildings:
    print("No buildings found")
    exit()

b_id = buildings[0]['id']

# 3. Get floors
req_f = urllib.request.Request(f'http://127.0.0.1:8000/api/buildings/{b_id}/floors', headers=headers)
floors = json.loads(urllib.request.urlopen(req_f).read())
print("Floors:", floors)

if not floors:
    print("No floors found")
    exit()

f_id = floors[0]['id']

# 4. Get slots
req_s = urllib.request.Request(f'http://127.0.0.1:8000/api/floors/{f_id}/slots', headers=headers)
slots = json.loads(urllib.request.urlopen(req_s).read())
print("Slots count:", len(slots))

if not slots:
    # Get categories to create a slot
    req_c = urllib.request.Request('http://127.0.0.1:8000/api/equipment-categories', headers=headers)
    cats = json.loads(urllib.request.urlopen(req_c).read())
    print("Categories:", cats)
    if not cats:
        print("No categories")
        exit()
    cat_id = cats[0]['id']
    
    # Create slot
    create_slot_data = json.dumps({"category_id": cat_id, "position_x": 100.0, "position_y": 100.0}).encode('utf-8')
    req_cs = urllib.request.Request(f'http://127.0.0.1:8000/api/floors/{f_id}/slots', data=create_slot_data, headers=headers)
    new_slot = json.loads(urllib.request.urlopen(req_cs).read())
    print("Created slot:", new_slot)
    slot_id = new_slot['id']
else:
    slot_id = slots[0]['id']

print("Testing assign on slot_id:", slot_id)
# 5. Assign equipment to slot
req_assign = urllib.request.Request(f'http://127.0.0.1:8000/api/slots/{slot_id}/assign', data=b'', headers=headers, method='POST')
try:
    res_assign = urllib.request.urlopen(req_assign)
    print("Assign success:", res_assign.read().decode())
except Exception as e:
    print("Assign failed status:", getattr(e, 'code', None))
    print("Assign failed response:", e.read().decode() if hasattr(e, 'read') else str(e))
