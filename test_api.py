import urllib.request
import json
import uuid

def check_endpoints():
    base_url = "http://localhost:8000/api"
    
    endpoints = [
        "/buildings",
        "/equipment-categories",
    ]
    
    for ep in endpoints:
        try:
            req = urllib.request.Request(base_url + ep)
            with urllib.request.urlopen(req) as response:
                print(f"SUCCESS {ep}:", len(json.loads(response.read().decode())))
        except Exception as e:
            print(f"FAILED {ep}:", e)
            
    # Try getting first floor to get slots
    try:
        req = urllib.request.Request(base_url + "/buildings")
        with urllib.request.urlopen(req) as res:
            buildings = json.loads(res.read().decode())
            if buildings:
                b_id = buildings[0]['id']
                req2 = urllib.request.Request(base_url + f"/buildings/{b_id}/floors")
                with urllib.request.urlopen(req2) as res2:
                    floors = json.loads(res2.read().decode())
                    if floors:
                        f_id = floors[0]['id']
                        print(f"Checking slots for floor {f_id}")
                        req3 = urllib.request.Request(base_url + f"/floors/{f_id}/slots")
                        try:
                            with urllib.request.urlopen(req3) as res3:
                                print("SUCCESS slots:", len(json.loads(res3.read().decode())))
                        except Exception as e:
                            print("FAILED slots:", e)
                            if hasattr(e, 'read'):
                                print(e.read().decode())
    except Exception as e:
        print("Failed getting buildings/floors:", e)

check_endpoints()
