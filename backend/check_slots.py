import urllib.request, json
try:
    req = urllib.request.Request('http://localhost:8000/api/floors')
    resp = urllib.request.urlopen(req)
    floors = json.loads(resp.read().decode())
    floor_id = floors[0]['id']
    req = urllib.request.Request(f'http://localhost:8000/api/floors/{floor_id}/slots')
    resp = urllib.request.urlopen(req)
    slots = json.loads(resp.read().decode())
    for s in slots:
      if s.get('equipment_id'):
        print(f"Slot {s['id']} has equipment {s['equipment_id']} {s.get('equipment', {}).get('name')}")
      else:
        print(f"Slot {s['id']} is EMPTY")
except Exception as e:
    print(e)
