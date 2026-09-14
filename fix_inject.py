import ast

with open('backend/inject_data.py', 'r', encoding='utf-8') as f:
    raw = f.read()

if raw.startswith('import asyncioz'):
    raw = 'import asyncio' + raw[15:]

parts = raw.split(r'\n')

fixed_lines = []
for p in parts:
    if "coordinates='[" in p:
        p = p.replace("coordinates='[", "coordinates=[").replace("]'))", "]))")
    
    if 'SlotTemplate(' in p:
        p = p.replace(', is_active=None, building_name=None, floor_name=None', '')
        
    if 'AssetInventory(' in p:
        p = p.replace(', purchase_date=None, warranty_months=None, expired_date=None', '')
        p = p.replace(', is_active=None', '')
        
    if 'InventoryHistoryLog(' in p:
        p = p.replace(', condition=None', '')
        p = p.replace(', notes=None', '')
        
    fixed_lines.append(p)

fixed_content = '\n'.join(fixed_lines)

with open('backend/inject_data.py', 'w', encoding='utf-8') as f:
    f.write(fixed_content)

print('Fixed inject_data.py successfully.')
