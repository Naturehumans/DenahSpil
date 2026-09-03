import sqlite3

conn = sqlite3.connect("spildenah.db")
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE asset_inventory ADD COLUMN brand VARCHAR(100)")
    print("Added brand")
except sqlite3.OperationalError as e:
    print(f"brand error: {e}")

try:
    cursor.execute("ALTER TABLE asset_inventory ADD COLUMN model_number VARCHAR(100)")
    print("Added model_number")
except sqlite3.OperationalError as e:
    print(f"model_number error: {e}")

conn.commit()
conn.close()
print("Done")
