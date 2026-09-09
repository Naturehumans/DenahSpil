import asyncio
import datetime
import uuid
import os
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, delete

from app.models.user import User
from app.models.building import Building
from app.models.floor import Floor
from app.models.equipment_category import EquipmentCategory
from app.models.equipment import Equipment
from app.models.slot_template import SlotTemplate
from app.models.asset_inventory import AssetInventory
from app.models.inventory_history_log import InventoryHistoryLog
from app.utils.security import hash_password

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def inject_data():
    print("=" * 60)
    print("Starting Comprehensive Data Injection for Denah SPIL...")
    print("=" * 60)

    async with AsyncSessionLocal() as db:
        # 1. Pastikan User Admin ada
        user_res = await db.execute(select(User).where(User.username == "admin"))
        user = user_res.scalars().first()
        if not user:
            user = User(
                username="admin",
                email="admin@spildenah.com",
                hashed_password=hash_password("admin123"),
                is_active=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print("[+] User 'admin' dibuat.")
        else:
            print(f"[*] User 'admin' ditemukan: {user.id}")

        # 2. Pastikan Building ada
        bldg_res = await db.execute(select(Building).where(Building.name == "Gedung Utama"))
        building = bldg_res.scalars().first()
        if not building:
            building = Building(
                name="Gedung Utama",
                description="Kantor Pusat SPIL - Gedung Operasional",
                total_floors=2
            )
            db.add(building)
            await db.commit()
            await db.refresh(building)
            print("[+] Building 'Gedung Utama' dibuat.")
        else:
            print(f"[*] Building 'Gedung Utama' ditemukan: {building.id}")

        # 3. Kategori Peralatan
        categories_data = [
            {"name": "AC", "color": "#3b82f6", "icon_url": "snowflake"},
            {"name": "Lampu", "color": "#fbbf24", "icon_url": "lightbulb"},
            {"name": "Kipas Angin", "color": "#22c55e", "icon_url": "fan"},
            {"name": "Proyektor", "color": "#a855f7", "icon_url": "projector"},
            {"name": "APAR", "color": "#ef4444", "icon_url": "fire-extinguisher"},
        ]

        cat_map = {}
        for cdata in categories_data:
            res = await db.execute(select(EquipmentCategory).where(EquipmentCategory.name == cdata["name"]))
            cat = res.scalars().first()
            if not cat:
                cat = EquipmentCategory(
                    name=cdata["name"],
                    color=cdata["color"],
                    icon_url=cdata["icon_url"],
                    initial_stock=0,
                    has_id=True
                )
                db.add(cat)
                await db.commit()
                await db.refresh(cat)
                print(f"[+] Kategori '{cdata['name']}' dibuat.")
            else:
                cat_map[cat.name] = cat
                print(f"[*] Kategori '{cdata['name']}' siap.")
            cat_map[cdata["name"]] = cat

        # 4. Denah / Lantai (Floors)
        floors_data = [
            {
                "name": "Lantai Dasar",
                "floor_number": 1,
                "floor_plan_image_url": "/api/uploads/7e95079b-80cf-4923-95fd-5d191cacfb93.webp",
                "canvas_width": 1200,
                "canvas_height": 800,
                "sort_order": 1
            },
            {
                "name": "Lantai 4",
                "floor_number": 2,
                "floor_plan_image_url": "/api/uploads/5709b814-b0b4-47d0-bd3b-f658c8f8d113.webp",
                "canvas_width": 1200,
                "canvas_height": 800,
                "sort_order": 2
            }
        ]

        floor_map = {}
        for fdata in floors_data:
            res = await db.execute(select(Floor).where(Floor.name == fdata["name"]))
            floor = res.scalars().first()
            if not floor:
                floor = Floor(
                    building_id=building.id,
                    name=fdata["name"],
                    floor_number=fdata["floor_number"],
                    floor_plan_image_url=fdata["floor_plan_image_url"],
                    canvas_width=fdata["canvas_width"],
                    canvas_height=fdata["canvas_height"],
                    sort_order=fdata["sort_order"]
                )
                db.add(floor)
                await db.commit()
                await db.refresh(floor)
                print(f"[+] Lantai '{fdata['name']}' dibuat.")
            else:
                # Update image jika belum ada
                if not floor.floor_plan_image_url:
                    floor.floor_plan_image_url = fdata["floor_plan_image_url"]
                    await db.commit()
                print(f"[*] Lantai '{fdata['name']}' siap.")
            floor_map[fdata["name"]] = floor

        today = datetime.date.today()
        now = datetime.datetime.now(datetime.timezone.utc)

        # 5. Equipments (Peralatan Terpasang di Denah)
        # Ambil equipment yang sudah ada
        eq_res = await db.execute(select(Equipment))
        existing_eqs = eq_res.scalars().all()
        existing_eq_names = {e.name for e in existing_eqs}

        new_equipments = [
            # Lantai Dasar
            {
                "floor": floor_map["Lantai Dasar"],
                "category": cat_map["AC"],
                "name": "AC - Ruang Utama 1",
                "brand": "Daikin",
                "model_number": "FTKQ25UVM4 (1 PK)",
                "installation_date": today - relativedelta(months=6),
                "lifespan_months": 36,
                "expiry_date": today + relativedelta(months=30),
                "position_x": 368.0,
                "position_y": 94.0,
                "status": "active",
                "notes": "AC Ruang Utama sisi utara, servis rutin tiap 3 bulan."
            },
            {
                "floor": floor_map["Lantai Dasar"],
                "category": cat_map["Kipas Angin"],
                "name": "Kipas Angin - Ruang Utama 1",
                "brand": "Panasonic",
                "model_number": "F-EQ405 (Wall Fan)",
                "installation_date": today - relativedelta(months=10),
                "lifespan_months": 24,
                "expiry_date": today + relativedelta(months=14),
                "position_x": 245.0,
                "position_y": 92.0,
                "status": "active",
                "notes": "Kipas angin dinding ruang tunggu."
            },
            {
                "floor": floor_map["Lantai Dasar"],
                "category": cat_map["Lampu"],
                "name": "Lampu LED - Lobby Utama",
                "brand": "Philips",
                "model_number": "LED Tube T8 18W",
                "installation_date": today - relativedelta(months=11, days=20),
                "lifespan_months": 12,
                "expiry_date": today + relativedelta(days=10),
                "position_x": 157.0,
                "position_y": 178.0,
                "status": "warning",  # Mendekati habis masa pakai
                "notes": "Perlu dijadwalkan penggantian lampu LED."
            },
            {
                "floor": floor_map["Lantai Dasar"],
                "category": cat_map["APAR"],
                "name": "APAR Powder - Koridor Depan",
                "brand": "Servvo",
                "model_number": "P 300 (3 kg ABC Powder)",
                "installation_date": today - relativedelta(months=12, days=5),
                "lifespan_months": 12,
                "expiry_date": today - relativedelta(days=5),
                "position_x": 120.0,
                "position_y": 300.0,
                "status": "expired",  # Sudah kadaluarsa
                "notes": "Tekanan gas turun, wajib refill segera."
            },
            {
                "floor": floor_map["Lantai Dasar"],
                "category": cat_map["Proyektor"],
                "name": "Proyektor - Ruang Rapat Kecil",
                "brand": "Epson",
                "model_number": "EB-E500 3300 Lumens",
                "installation_date": today - relativedelta(months=4),
                "lifespan_months": 36,
                "expiry_date": today + relativedelta(months=32),
                "position_x": 480.0,
                "position_y": 210.0,
                "status": "active",
                "notes": "Kondisi lampu proyektor sangat baik."
            },

            # Lantai 4
            {
                "floor": floor_map["Lantai 4"],
                "category": cat_map["AC"],
                "name": "AC - Ruang Direksi (L4)",
                "brand": "LG",
                "model_number": "Dual Cool Eco Inverter 2 PK",
                "installation_date": today - relativedelta(months=8),
                "lifespan_months": 36,
                "expiry_date": today + relativedelta(months=28),
                "position_x": 219.0,
                "position_y": 92.0,
                "status": "active",
                "notes": "Temperatur diatur stabil 22°C."
            },
            {
                "floor": floor_map["Lantai 4"],
                "category": cat_map["AC"],
                "name": "AC - Server Room (L4)",
                "brand": "Daikin",
                "model_number": "SkyAir Ceiling Cassette 3 PK",
                "installation_date": today - relativedelta(months=11, days=25),
                "lifespan_months": 12,
                "expiry_date": today + relativedelta(days=5),
                "position_x": 429.0,
                "position_y": 98.0,
                "status": "warning",
                "notes": "Unit pendingin ruang server, butuh pembersihan filter."
            },
            {
                "floor": floor_map["Lantai 4"],
                "category": cat_map["Proyektor"],
                "name": "Proyektor - Ballroom / Ruang Rapat Utama",
                "brand": "Epson",
                "model_number": "EB-2250U WUXGA",
                "installation_date": today - relativedelta(months=5),
                "lifespan_months": 36,
                "expiry_date": today + relativedelta(months=31),
                "position_x": 571.0,
                "position_y": 235.0,
                "status": "active",
                "notes": "Proyektor utama untuk meeting mingguan."
            },
            {
                "floor": floor_map["Lantai 4"],
                "category": cat_map["APAR"],
                "name": "APAR CO2 - Depan Server Room",
                "brand": "Yamato",
                "model_number": "YC-5NX (5 kg CO2)",
                "installation_date": today - relativedelta(months=13),
                "lifespan_months": 12,
                "expiry_date": today - relativedelta(months=1),
                "position_x": 674.0,
                "position_y": 126.0,
                "status": "expired",
                "notes": "Khusus ruang kelistrikan dan server, masa inspeksi lewat."
            },
            {
                "floor": floor_map["Lantai 4"],
                "category": cat_map["Lampu"],
                "name": "Lampu Downlight - Hallway L4",
                "brand": "Philips",
                "model_number": "Meson LED 13W",
                "installation_date": today - relativedelta(months=3),
                "lifespan_months": 24,
                "expiry_date": today + relativedelta(months=21),
                "position_x": 327.0,
                "position_y": 328.0,
                "status": "active",
                "notes": "Pencahayaan lorong tengah."
            }
        ]

        created_eq_map = {}
        for eq_data in new_equipments:
            if eq_data["name"] not in existing_eq_names:
                new_eq = Equipment(
                    id=uuid.uuid4(),
                    floor_id=eq_data["floor"].id,
                    category_id=eq_data["category"].id,
                    placed_by=user.id,
                    name=eq_data["name"],
                    brand=eq_data["brand"],
                    model_number=eq_data["model_number"],
                    installation_date=eq_data["installation_date"],
                    lifespan_months=eq_data["lifespan_months"],
                    expiry_date=eq_data["expiry_date"],
                    position_x=eq_data["position_x"],
                    position_y=eq_data["position_y"],
                    status=eq_data["status"],
                    notes=eq_data["notes"]
                )
                db.add(new_eq)
                created_eq_map[eq_data["name"]] = new_eq
            else:
                # Simpan referensi existing
                for e in existing_eqs:
                    if e.name == eq_data["name"]:
                        created_eq_map[eq_data["name"]] = e
                        break

        await db.commit()
        print(f"[+] Total {len(created_eq_map)} equipments siap di denah.")

        # 6. Slot Inventory (Slot Templates)
        # Hubungkan slot yang ada dengan equipment yang baru dibuat jika belum terhubung
        slots_res = await db.execute(select(SlotTemplate))
        all_slots = slots_res.scalars().all()
        print(f"[*] Menyesuaikan {len(all_slots)} slot inventory...")

        # Update slot matching coordinates / floor
        for slot in all_slots:
            if not slot.equipment_id:
                # Cari equipment yang posisinya mendekati slot
                for eq in created_eq_map.values():
                    if eq.floor_id == slot.floor_id and eq.category_id == slot.category_id:
                        dist = abs(eq.position_x - slot.position_x) + abs(eq.position_y - slot.position_y)
                        if dist < 30.0:  # Posisi cocok
                            slot.equipment_id = eq.id
                            break
        await db.commit()
        print("[+] Slot templates telah disinkronkan dengan equipment.")

        # 7. Asset Inventory (Stok Gudang / Cadangan Belum Terpasang)
        # Cek apakah sudah ada aset
        asset_res = await db.execute(select(AssetInventory))
        existing_assets = asset_res.scalars().all()

        if not existing_assets:
            mock_assets = [
                # AC
                {"category": cat_map["AC"], "asset_id": "AST-AC-001", "brand": "Daikin", "model_number": "FTKQ25UVM4 (1 PK)", "status": "available"},
                {"category": cat_map["AC"], "asset_id": "AST-AC-002", "brand": "LG", "model_number": "Dual Cool Eco 1.5 PK", "status": "available"},
                {"category": cat_map["AC"], "asset_id": "AST-AC-003", "brand": "Panasonic", "model_number": "CS-YN9WKJ (1 PK)", "status": "maintenance"},
                {"category": cat_map["AC"], "asset_id": "AST-AC-004", "brand": "Sharp", "model_number": "AH-A5SAY (0.5 PK)", "status": "available"},

                # Lampu
                {"category": cat_map["Lampu"], "asset_id": "AST-LMP-001", "brand": "Philips", "model_number": "LED Tube T8 18W", "status": "available"},
                {"category": cat_map["Lampu"], "asset_id": "AST-LMP-002", "brand": "Philips", "model_number": "LED Tube T8 18W", "status": "available"},
                {"category": cat_map["Lampu"], "asset_id": "AST-LMP-003", "brand": "Philips", "model_number": "Downlight Meson 13W", "status": "available"},
                {"category": cat_map["Lampu"], "asset_id": "AST-LMP-004", "brand": "Panasonic", "model_number": "LED Neo Bulb 15W", "status": "available"},
                {"category": cat_map["Lampu"], "asset_id": "AST-LMP-005", "brand": "Hannochs", "model_number": "Premier LED 20W", "status": "maintenance"},

                # Kipas Angin
                {"category": cat_map["Kipas Angin"], "asset_id": "AST-KPS-001", "brand": "Panasonic", "model_number": "F-EQ405 (Wall Fan)", "status": "available"},
                {"category": cat_map["Kipas Angin"], "asset_id": "AST-KPS-002", "brand": "Miyako", "model_number": "KAW-1689 RC", "status": "available"},
                {"category": cat_map["Kipas Angin"], "asset_id": "AST-KPS-003", "brand": "Sekai", "model_number": "IST 1851 (Industrial Stand)", "status": "available"},
                {"category": cat_map["Kipas Angin"], "asset_id": "AST-KPS-004", "brand": "KDK", "model_number": "WR40U (Auto Fan)", "status": "maintenance"},

                # Proyektor
                {"category": cat_map["Proyektor"], "asset_id": "AST-PRJ-001", "brand": "Epson", "model_number": "EB-E500 3300 Lumens", "status": "available"},
                {"category": cat_map["Proyektor"], "asset_id": "AST-PRJ-002", "brand": "InFocus", "model_number": "IN112x DLP 3800 Lumens", "status": "available"},
                {"category": cat_map["Proyektor"], "asset_id": "AST-PRJ-003", "brand": "BenQ", "model_number": "MS550 SVGA", "status": "maintenance"},

                # APAR
                {"category": cat_map["APAR"], "asset_id": "AST-APR-001", "brand": "Servvo", "model_number": "P 300 (3 kg ABC Powder)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-002", "brand": "Servvo", "model_number": "P 600 (6 kg ABC Powder)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-003", "brand": "Yamato", "model_number": "YC-5NX (5 kg CO2)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-004", "brand": "Gunnebo", "model_number": "Foam AFFF 6 Liter", "status": "maintenance"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-005", "brand": "Servvo", "model_number": "P 300 (3 kg)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-006", "brand": "Servvo", "model_number": "P 300 (3 kg)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-007", "brand": "Servvo", "model_number": "P 300 (3 kg)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-008", "brand": "Servvo", "model_number": "P 300 (3 kg)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-009", "brand": "Servvo", "model_number": "P 300 (3 kg)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-010", "brand": "Servvo", "model_number": "P 300 (3 kg)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-011", "brand": "Servvo", "model_number": "P 300 (3 kg)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-012", "brand": "Servvo", "model_number": "P 300 (3 kg)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-013", "brand": "Servvo", "model_number": "P 300 (3 kg)", "status": "available"},
                {"category": cat_map["APAR"], "asset_id": "AST-APR-014", "brand": "Servvo", "model_number": "P 300 (3 kg)", "status": "available"},
            ]

            for a in mock_assets:
                new_asset = AssetInventory(
                    id=uuid.uuid4(),
                    category_id=a["category"].id,
                    asset_id=a["asset_id"],
                    brand=a["brand"],
                    model_number=a["model_number"],
                    status=a["status"]
                )
                db.add(new_asset)
            await db.commit()
            print(f"[+] Berhasil menambahkan {len(mock_assets)} aset ke Asset Inventory (Stok Gudang).")
        else:
            print(f"[*] Asset Inventory sudah memiliki {len(existing_assets)} record.")

        # 8. Inventory History Logs (Riwayat Log Aktivitas)
        log_res = await db.execute(select(InventoryHistoryLog))
        existing_logs = log_res.scalars().all()

        # Tambahkan log aktivitas lengkap
        new_logs = [
            {
                "category": cat_map["AC"],
                "asset_id": "AST-AC-001",
                "slot_code": "GUAC11",
                "action_type": "deploy",
                "location_info": "Pemasangan unit baru di Ruang Utama",
                "building_name": "Gedung Utama",
                "floor_name": "Lantai Dasar",
                "room_name": "Ruang Utama",
                "brand": "Daikin",
                "model_number": "FTKQ25UVM4 (1 PK)",
                "status": "Dipasang",
                "days_ago": 180
            },
            {
                "category": cat_map["AC"],
                "asset_id": "AST-AC-003",
                "slot_code": "GUAC21",
                "action_type": "maintenance",
                "location_info": "Pembersihan filter dan isi ulang freon R32",
                "building_name": "Gedung Utama",
                "floor_name": "Lantai 4",
                "room_name": "Ruang Direksi",
                "brand": "Panasonic",
                "model_number": "CS-YN9WKJ",
                "status": "Perawatan",
                "days_ago": 15
            },
            {
                "category": cat_map["Lampu"],
                "asset_id": "AST-LMP-001",
                "slot_code": "GULM11",
                "action_type": "deploy",
                "location_info": "Pemasangan lampu LED T8 hemat energi",
                "building_name": "Gedung Utama",
                "floor_name": "Lantai Dasar",
                "room_name": "Lobby Utama",
                "brand": "Philips",
                "model_number": "LED Tube T8 18W",
                "status": "Dipasang",
                "days_ago": 90
            },
            {
                "category": cat_map["Kipas Angin"],
                "asset_id": "AST-KPS-001",
                "slot_code": "GUKA11",
                "action_type": "move",
                "location_info": "Dipindahkan dari Ruang Rapat ke Ruang Utama",
                "building_name": "Gedung Utama",
                "floor_name": "Lantai Dasar",
                "room_name": "Ruang Utama",
                "brand": "Panasonic",
                "model_number": "F-EQ405",
                "status": "Dipasang (Dipindahkan)",
                "days_ago": 45
            },
            {
                "category": cat_map["Proyektor"],
                "asset_id": "AST-PRJ-001",
                "slot_code": "GUPR41",
                "action_type": "deploy",
                "location_info": "Instalasi proyektor ceiling mount untuk meeting",
                "building_name": "Gedung Utama",
                "floor_name": "Lantai 4",
                "room_name": "Ballroom",
                "brand": "Epson",
                "model_number": "EB-2250U",
                "status": "Dipasang",
                "days_ago": 60
            },
            {
                "category": cat_map["APAR"],
                "asset_id": "AST-APR-001",
                "slot_code": "GUAP11",
                "action_type": "deploy",
                "location_info": "Penempatan APAR powder di titik evakuasi",
                "building_name": "Gedung Utama",
                "floor_name": "Lantai Dasar",
                "room_name": "Koridor Depan",
                "brand": "Servvo",
                "model_number": "P 300 (3 kg)",
                "status": "Dipasang",
                "days_ago": 120
            },
            {
                "category": cat_map["APAR"],
                "asset_id": "AST-APR-003",
                "slot_code": "GUAP41",
                "action_type": "maintenance",
                "location_info": "Pemeriksaan berkala tekanan dan kondisi seal",
                "building_name": "Gedung Utama",
                "floor_name": "Lantai 4",
                "room_name": "Depan Server Room",
                "brand": "Yamato",
                "model_number": "YC-5NX (5 kg CO2)",
                "status": "Pemeriksaan",
                "days_ago": 7
            },
            {
                "category": cat_map["Lampu"],
                "asset_id": "AST-LMP-005",
                "slot_code": None,
                "action_type": "remove",
                "location_info": "Lampu redup/berkedip ditarik ke gudang teknisi",
                "building_name": "Gedung Utama",
                "floor_name": "Lantai Dasar",
                "room_name": "Pantry",
                "brand": "Hannochs",
                "model_number": "Premier LED 20W",
                "status": "Ditarik",
                "days_ago": 3
            },
            {
                "category": cat_map["Kipas Angin"],
                "asset_id": "AST-KPS-004",
                "slot_code": None,
                "action_type": "inbound",
                "location_info": "Penerimaan unit baru dari supplier",
                "building_name": "Gedung Utama",
                "floor_name": "Gudang Logistik",
                "room_name": "Gudang B2",
                "brand": "KDK",
                "model_number": "WR40U",
                "status": "Tersedia",
                "days_ago": 2
            }
        ]

        inserted_logs = 0
        for l in new_logs:
            log_time = now - datetime.timedelta(days=l["days_ago"])
            history_log = InventoryHistoryLog(
                id=uuid.uuid4(),
                category_id=l["category"].id,
                asset_id=l["asset_id"],
                slot_code=l["slot_code"],
                action_type=l["action_type"],
                location_info=l["location_info"],
                building_name=l["building_name"],
                floor_name=l["floor_name"],
                room_name=l["room_name"],
                brand=l["brand"],
                model_number=l["model_number"],
                status=l["status"],
                performed_by=user.id,
                created_at=log_time
            )
            db.add(history_log)
            inserted_logs += 1

        await db.commit()
        print(f"[+] Berhasil menambahkan {inserted_logs} log aktivitas ke Inventory History Logs.")

    print("=" * 60)
    print("Injection Data Selesai 100%!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(inject_data())
