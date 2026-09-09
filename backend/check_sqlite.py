import sqlite3

conn = sqlite3.connect('spildenah.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print('Tables in SQLite:')
for t in tables:
    cursor.execute(f"SELECT COUNT(*) FROM {t[0]}")
    count = cursor.fetchone()[0]
    print(f"  {t[0]}: {count} rows")

# Also show schema
print('\nSchemas:')
for t in tables:
    cursor.execute(f"PRAGMA table_info({t[0]})")
    cols = cursor.fetchall()
    print(f"\n  [{t[0]}]")
    for c in cols:
        print(f"    {c[1]} ({c[2]})")

conn.close()
