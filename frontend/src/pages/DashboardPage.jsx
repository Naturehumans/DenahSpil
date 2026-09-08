import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import MainLayout from '../components/Layout/MainLayout';
import FloorCanvas from '../components/Canvas/FloorCanvas';
import Modal from '../components/UI/Modal';
import AreaManagement from '../components/Forms/AreaManagement';
import CategoryForm from '../components/Forms/CategoryForm';
import EquipmentForm from '../components/Forms/EquipmentForm';
import InventoryManagement from '../components/Forms/InventoryManagement';
import ConfirmModal from '../components/UI/ConfirmModal';
import { useToast } from '../contexts/ToastContext';
import Skeleton from '../components/UI/Skeleton';

// API imports
import { getBuildings, createBuilding, updateBuilding, deleteBuilding } from '../api/buildings';
import { getFloors, createFloor, updateFloor, deleteFloor } from '../api/floors';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/categories';
import { 
  getEquipmentsByFloor, 
  createEquipment, 
  updateEquipmentPosition,
  getEquipmentStats,
  getExpiringEquipments,
  updateEquipment,
  deleteEquipment
} from '../api/equipments';
import { 
  getSlotsByFloor, 
  createSlot, 
  updateSlotPosition, 
  deleteSlot, 
  assignItemToSlot, 
  moveItemBetweenSlots, 
  unassignItemFromSlot 
} from '../api/slots';
import api from '../api/axios';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [buildings, setBuildings] = useState([]);
  const [currentBuilding, setCurrentBuilding] = useState(null);
  
  const [floors, setFloors] = useState([]);
  const [currentFloor, setCurrentFloor] = useState(null);
  
  const [equipments, setEquipments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [slots, setSlots] = useState([]);
  
  const [unassignDate, setUnassignDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activeModal, setActiveModal] = useState(null); // 'floor', 'category', 'equipment', 'equipment_detail', 'equipment_edit'
  const [inventoryInitialTab, setInventoryInitialTab] = useState('good');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [newEqPos, setNewEqPos] = useState({ x: 400, y: 300 });
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmDeleteEq, setConfirmDeleteEq] = useState(false);
  const [confirmSlotDrop, setConfirmSlotDrop] = useState(null);
  const [confirmAssignItem, setConfirmAssignItem] = useState(null);
  const [highlightedSlotId, setHighlightedSlotId] = useState(null);
  const [warrantyConfirm, setWarrantyConfirm] = useState(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categoryBlockedNotice, setCategoryBlockedNotice] = useState(null);
  const [activeMobileSlotTemplate, setActiveMobileSlotTemplate] = useState(null);
  
  const { showToast } = useToast();

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const cats = await getCategories();
      setCategories(cats);

      const bldgs = await getBuildings();
      setBuildings(bldgs);

      if (bldgs.length > 0) {
        const savedBldgId = localStorage.getItem('spil_active_building_id');
        const savedFloorId = localStorage.getItem('spil_active_floor_id');

        let activeBldg = bldgs.find(b => String(b.id) === String(savedBldgId)) || bldgs[0];
        setCurrentBuilding(activeBldg);
        localStorage.setItem('spil_active_building_id', activeBldg.id);
        
        const flrs = await getFloors(activeBldg.id);
        setFloors(flrs);
        
        if (flrs.length > 0) {
          let activeFloor = flrs.find(f => String(f.id) === String(savedFloorId)) || flrs[0];
          setCurrentFloor(activeFloor);
          localStorage.setItem('spil_active_floor_id', activeFloor.id);
          
          const eqs = await getEquipmentsByFloor(activeFloor.id);
          setEquipments(eqs);
          
          const flrSlots = await getSlotsByFloor(activeFloor.id);
          setSlots(flrSlots);
        }
      }

    } catch (error) {
      showToast('Gagal memuat data awal', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [showToast]);

  const handleSelectFloor = async (floor) => {
    setCurrentFloor(floor);
    if (floor && floor.id) {
      localStorage.setItem('spil_active_floor_id', floor.id);
    }
    try {
      const eqs = await getEquipmentsByFloor(floor.id);
      setEquipments(eqs);
      const flrSlots = await getSlotsByFloor(floor.id);
      setSlots(flrSlots);
      setSelectedCategoryId(null); // Reset category filter on floor change
    } catch (error) {
      showToast('Gagal memuat data barang untuk lantai ini', 'error');
    }
  };

  const handleSelectBuilding = async (bldgId) => {
    const bldg = buildings.find(b => String(b.id) === String(bldgId) || b.id === parseInt(bldgId));
    if (!bldg) return;
    
    setCurrentBuilding(bldg);
    localStorage.setItem('spil_active_building_id', bldg.id);

    try {
      const flrs = await getFloors(bldg.id);
      setFloors(flrs);
      if (flrs.length > 0) {
        const savedFloorId = localStorage.getItem('spil_active_floor_id');
        const targetFloor = flrs.find(f => String(f.id) === String(savedFloorId)) || flrs[0];
        handleSelectFloor(targetFloor);
      } else {
        setCurrentFloor(null);
        setEquipments([]);
        setSlots([]);
        setSelectedCategoryId(null);
      }
    } catch (error) {
      showToast('Gagal memuat lantai area', 'error');
    }
  };



  const handleEquipmentMove = async (id, x, y) => {
    // Optimistic update
    setEquipments(prev => 
      prev.map(eq => eq.id === id ? { ...eq, position_x: x, position_y: y } : eq)
    );
    
    try {
      await updateEquipmentPosition(id, x, y);
    } catch (error) {
      showToast('Gagal menyimpan posisi baru', 'error');
    }
  };

  const handleEquipmentClick = (eq) => {
    setSelectedEquipment(eq);
    const slot = slots.find(s => s.equipment_id === eq.id || s.equipment?.id === eq.id);
    if (slot) setSelectedSlot(slot);
    setActiveModal('equipment_detail');
  };

  const handleEquipmentDoubleClick = async (eq) => {
    if (eq.floor_id && (!currentFloor || eq.floor_id !== currentFloor.id)) {
      const targetFloor = floors.find(f => f.id === eq.floor_id) || eq.floor;
      if (targetFloor) {
        await handleSelectFloor(targetFloor);
      }
    }
    
    const slot = slots.find(s => s.equipment_id === eq.id || s.equipment?.id === eq.id);
    if (slot) {
      setSelectedSlot(slot);
      setSelectedEquipment(eq);
      const slotCode = slot.slot_code || eq.slot_code || `Slot ${eq.name}`;
      const floorName = currentFloor ? currentFloor.name : 'Lantai ini';
      showToast(`Lokasi Slot Ditemukan: ${slotCode} terpasang di ${floorName}`, 'info');
      setHighlightedSlotId(slot.id);
      setTimeout(() => {
        setHighlightedSlotId(null);
      }, 4500);
    } else {
      showToast(`Barang '${eq.name}' belum terpasang pada slot di lantai ini`, 'warning');
    }

    setActiveModal(null);
  };

  const handleCanvasClick = async (pos) => {
    // In edit mode, we use drag and drop now. Canvas clicks don't do anything by themselves.
  };

  const handleSlotDrop = (categoryId, x, y) => {
    setActiveMobileSlotTemplate(null);
    const cat = categories.find(c => c.id === categoryId);
    setConfirmSlotDrop({ category: cat, x, y, roomName: '' });
  };

  const confirmCreateSlot = async () => {
    if (!currentFloor || !confirmSlotDrop) return;
    try {
      const roomName = (confirmSlotDrop.roomName || '').trim() || 'Ruang Utama';
      const newSlot = await createSlot(currentFloor.id, {
        category_id: confirmSlotDrop.category.id,
        position_x: confirmSlotDrop.x,
        position_y: confirmSlotDrop.y,
        room_name: roomName
      });
      newSlot.category = confirmSlotDrop.category; // optimistic
      newSlot.room_name = roomName;
      setSlots(prev => [...prev, newSlot]);
      showToast(`Slot ${confirmSlotDrop.category.name} di ${roomName} berhasil ditempatkan`, 'success');
    } catch (err) {
      showToast('Gagal membuat slot', 'error');
    } finally {
      setConfirmSlotDrop(null);
    }
  };

  const handleItemDropOnSlot = async (categoryId, slotId) => {
    if (!slotId) {
      showToast('Letakkan barang di atas slot yang sudah ada', 'warning');
      return;
    }
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    if (slot.category_id !== categoryId) {
      showToast('Kategori barang tidak cocok dengan slot ini', 'error');
      return;
    }

    const cat = categories.find(c => c.id === categoryId);
    
    // Fetch registered brands from localStorage or default mocks
    let categoryBrands = [];
    try {
      const saved = localStorage.getItem('spil_category_brands');
      if (saved) {
        const map = JSON.parse(saved);
        const key = (cat?.name || '').toLowerCase();
        categoryBrands = map[key] || map[cat?.id] || [];
      }
    } catch (e) {}

    // Fallback brand presets if none configured yet
    if (!categoryBrands || categoryBrands.length === 0) {
      const catNameLower = (cat?.name || '').toLowerCase();
      if (catNameLower.includes('ac')) {
        categoryBrands = [
          { id: 'b1', brand: 'LG', model_number: 'Inverter 1PK' },
          { id: 'b2', brand: 'Panasonic', model_number: 'Standard 2PK' },
          { id: 'b3', brand: 'Daikin', model_number: 'Inverter 1.5PK' }
        ];
      } else if (catNameLower.includes('lampu')) {
        categoryBrands = [
          { id: 'b4', brand: 'Philips', model_number: 'LED 14W' },
          { id: 'b5', brand: 'Hoppecke', model_number: 'Warm White 9W' }
        ];
      } else if (catNameLower.includes('kipas')) {
        categoryBrands = [
          { id: 'b6', brand: 'Miyako', model_number: 'Stand Fan 16"' },
          { id: 'b7', brand: 'Sekai', model_number: 'Wall Fan 18"' }
        ];
      } else if (catNameLower.includes('proyektor')) {
        categoryBrands = [
          { id: 'b8', brand: 'Epson', model_number: 'EB-X500' },
          { id: 'b9', brand: 'BenQ', model_number: 'MS550' }
        ];
      } else {
        categoryBrands = [
          { id: 'b10', brand: 'Standard', model_number: 'Model Regular' }
        ];
      }
    }

    const firstAvailableBrand = categoryBrands.find(b => b.stock === undefined || b.stock > 0);
    const firstBrand = firstAvailableBrand?.brand || categoryBrands[0]?.brand || '';
    const firstModel = firstAvailableBrand?.model_number || categoryBrands[0]?.model_number || '';
    const isCustomDefault = !firstAvailableBrand && categoryBrands.length > 0;

    setConfirmAssignItem({
      slotId,
      categoryId,
      category: cat,
      slot,
      categoryBrands,
      selectedBrand: firstBrand,
      selectedModel: firstModel,
      isCustom: isCustomDefault,
      customBrand: '',
      customModel: ''
    });
  };

  const updateBrandStockOnAssign = (category, brandName, modelNumber) => {
    try {
      const saved = localStorage.getItem('spil_category_brands');
      const map = saved ? JSON.parse(saved) : {};
      const catKey = (category?.name || '').toLowerCase();
      const brands = map[catKey] || map[category?.id] || [];

      let found = false;
      const updatedBrands = brands.map(b => {
        if ((b.brand || '').toLowerCase() === (brandName || '').toLowerCase() && (b.model_number || '').toLowerCase() === (modelNumber || '').toLowerCase()) {
          found = true;
          const currentStock = parseInt(b.stock) || 0;
          return { ...b, stock: Math.max(0, currentStock - 1) };
        }
        return b;
      });

      if (!found && brandName) {
        updatedBrands.push({
          id: 'b_' + Date.now(),
          brand: brandName,
          model_number: modelNumber || '',
          stock: 0,
          min_stock: 1
        });
      }

      map[catKey] = updatedBrands;
      if (category?.id) map[category.id] = updatedBrands;
      localStorage.setItem('spil_category_brands', JSON.stringify(map));
    } catch (e) {}
  };

  const updateBrandStockOnUnassign = (category, brandName, modelNumber) => {
    try {
      const saved = localStorage.getItem('spil_category_brands');
      const map = saved ? JSON.parse(saved) : {};
      const catKey = (category?.name || '').toLowerCase();
      const brands = map[catKey] || map[category?.id] || [];

      let found = false;
      const updatedBrands = brands.map(b => {
        if ((b.brand || '').toLowerCase() === (brandName || '').toLowerCase() && (b.model_number || '').toLowerCase() === (modelNumber || '').toLowerCase()) {
          found = true;
          const currentStock = parseInt(b.stock) || 0;
          return { ...b, stock: currentStock + 1 };
        }
        return b;
      });

      if (!found && brandName) {
        updatedBrands.push({
          id: 'b_' + Date.now(),
          brand: brandName,
          model_number: modelNumber || '',
          stock: 1,
          min_stock: 1
        });
      }

      map[catKey] = updatedBrands;
      if (category?.id) map[category.id] = updatedBrands;
      localStorage.setItem('spil_category_brands', JSON.stringify(map));
    } catch (e) {}
  };

  const saveToDamagedInventory = (category, equipment) => {
    try {
      const stored = localStorage.getItem('spil_damaged_inventory');
      const items = stored ? JSON.parse(stored) : [];
      const installed_at = equipment?.installed_at || equipment?.installation_date || equipment?.placed_at || equipment?.created_at || null;
      const newDamagedItem = {
        id: `dmg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        category_id: category?.id,
        category_name: category?.name || 'Umum',
        asset_id: equipment?.name || equipment?.asset_id || equipment?.slot_code || 'Aset',
        brand: equipment?.brand || 'Tanpa Merk',
        model_number: equipment?.model_number || 'Standard',
        installed_at: installed_at,
        unassigned_at: new Date().toISOString()
      };
      items.push(newDamagedItem);
      localStorage.setItem('spil_damaged_inventory', JSON.stringify(items));
    } catch (err) {
      console.error('Error saving damaged inventory to localStorage:', err);
    }
  };

  const confirmAssignEquipmentToSlot = async () => {
    if (!confirmAssignItem) return;
    try {
      const { slotId, selectedBrand, selectedModel, isCustom, customBrand, customModel, category } = confirmAssignItem;
      const finalBrand = isCustom ? customBrand.trim() : selectedBrand;
      const finalModel = isCustom ? customModel.trim() : selectedModel;

      if (isCustom && !finalBrand) {
        showToast('Silakan masukkan nama merk barang', 'error');
        return;
      }

      const updatedSlot = await assignItemToSlot(slotId, finalBrand, finalModel);
      setSlots(prev => prev.map(s => s.id === slotId ? updatedSlot : s));
      
      // Reduce brand stock by 1
      if (category) {
        updateBrandStockOnAssign(category, finalBrand, finalModel);
      }

      // refresh categories to update stock
      const cats = await getCategories();
      setCategories(cats);
      
      showToast(`Barang ${finalBrand || ''} berhasil dipasang! (Stok merk ${finalBrand} berkurang 1)`, 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Gagal menempatkan barang', 'error');
    } finally {
      setConfirmAssignItem(null);
    }
  };

  const triggerUnassignWithWarrantyCheck = async (slotId, destination) => {
    if (destination === 'good') {
      return handleUnassignItem(slotId, destination);
    }

    const slotToUnassign = slots.find(s => s.id === slotId);
    const eq = slotToUnassign?.equipment;
    const cat = slotToUnassign?.category || categories.find(c => c.id === slotToUnassign?.category_id);

    if (eq && eq.brand && cat) {
      try {
        const saved = localStorage.getItem('spil_category_brands');
        if (saved) {
          const map = JSON.parse(saved);
          const catKey = (cat.name || '').toLowerCase();
          const brands = map[catKey] || map[cat.id] || [];
          const brandObj = brands.find(b => (b.brand || '').toLowerCase() === eq.brand.toLowerCase());
          
          if (brandObj && brandObj.warranty_months > 0) {
            const baseDateStr = eq.installation_date || eq.created_at || eq.placed_at || brandObj.created_at;
            if (baseDateStr) {
              const installDate = new Date(baseDateStr);
              const expirationDate = new Date(installDate);
              expirationDate.setMonth(expirationDate.getMonth() + brandObj.warranty_months);
              
              if (new Date() < expirationDate) {
                const now = new Date();
                const diffTime = Math.max(0, now - installDate);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const diffMonths = (diffDays / 30).toFixed(1);
              
              setWarrantyConfirm({
                slotId,
                destination,
                eqName: eq.name,
                brand: eq.brand,
                modelNumber: eq.model_number,
                installDateStr: installDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
                usageDays: diffDays,
                usageMonths: diffMonths,
                warrantyMonths: brandObj.warranty_months
              });
              setActiveModal(null);
              return;
              }
            }
          }
        }
      } catch (e) {
        console.error('Error checking warranty:', e);
      }
    }
    
    return handleUnassignItem(slotId, destination);
  };

  const handleUnassignItem = async (slotId, destination = null) => {
    try {
      const slotToUnassign = slots.find(s => s.id === slotId);
      if (!slotToUnassign) return;
      
      const cat = categories.find(c => c.id === slotToUnassign.category_id);
      const eq = slotToUnassign.equipment || (slotToUnassign.equipment_id ? equipments.find(e => e.id === slotToUnassign.equipment_id) : null);
      
      let formattedDate = null;
      if (destination && unassignDate) {
        // Create an ISO string keeping the time but using the selected date
        const d = new Date(unassignDate);
        d.setHours(new Date().getHours());
        d.setMinutes(new Date().getMinutes());
        formattedDate = d.toISOString();
      }

      if (slotToUnassign && slotToUnassign.equipment_id) {
        setEquipments(prev => prev.filter(e => e.id !== slotToUnassign.equipment_id));
      }

      await unassignItemFromSlot(slotId, destination, formattedDate);
      setSlots(prev => prev.map(s => s.id === slotId ? { ...s, equipment_id: null, equipment: null } : s));
      
      // If returned to "Masuk Inventori Baru (Stok Siap Pakai)", restore brand stock by 1
      if (destination === 'good' && cat) {
        updateBrandStockOnUnassign(cat, eq?.brand || slotToUnassign?.brand, eq?.model_number || slotToUnassign?.model_number);
      }

      // If moved to "Masuk Inventori Rusak (Perbaikan)", save to spil_damaged_inventory
      if (destination === 'damaged') {
        saveToDamagedInventory(cat, eq || slotToUnassign);
      }

      // refresh categories to update stock
      const cats = await getCategories();
      setCategories(cats);
      
      setActiveModal(null);
      setSelectedSlot(null);
      setUnassignDate('');
      showToast(
        destination === 'good' 
          ? 'Barang dilepas & stok merk berhasil dikembalikan (+1)' 
          : destination === 'damaged'
          ? 'Barang dilepas & dimasukkan ke Inventori Rusak'
          : 'Barang dihapus dari template', 
        'success'
      );
    } catch (err) {
      console.error("Error unassigning item:", err);
      showToast(err.response?.data?.detail || err.message || 'Gagal menghapus barang', 'error');
    }
  };

  const handleUpdateEquipmentStatus = async (equipmentId, newStatus) => {
    try {
      const responseEq = await updateEquipment(equipmentId, { status: newStatus });
      const existingEq = equipments.find(e => e.id === equipmentId) || {};
      const updatedEq = { ...existingEq, ...responseEq, category: existingEq.category || responseEq.category };
      
      setEquipments(prev => prev.map(eq => eq.id === equipmentId ? updatedEq : eq));
      
      const currentSlot = selectedSlot || slots.find(s => s.equipment_id === equipmentId);

      if (currentSlot) {
        setSlots(prev => prev.map(s => s.equipment_id === equipmentId ? { ...s, equipment: updatedEq } : s));
      }
      
      setSelectedEquipment(updatedEq);
      showToast('Kondisi barang berhasil diubah', 'success');
    } catch (err) {
      let errorMsg = 'Gagal mengubah kondisi barang';
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') errorMsg = detail;
      else if (Array.isArray(detail)) errorMsg = detail[0]?.msg || JSON.stringify(detail);
      
      showToast(errorMsg, 'error');
    }
  };

  const handleSlotMove = async (id, x, y, isFilled = false) => {
    const sourceSlot = slots.find(s => s.id === id);
    if (!sourceSlot) return;

    if (isFilled && (sourceSlot.equipment_id || sourceSlot.equipment)) {
      // Find an EMPTY target slot of the SAME category near drop coordinates (within 60px)
      const targetSlot = slots.find(s => 
        s.id !== id && 
        s.equipment_id == null && 
        (String(s.category_id) === String(sourceSlot.category_id) || 
         String(s.category?.id) === String(sourceSlot.category_id) ||
         String(s.category_id) === String(sourceSlot.category?.id)) &&
        Math.sqrt(Math.pow(s.position_x - x, 2) + Math.pow(s.position_y - y, 2)) < 60
      );

      if (targetSlot) {
        // Optimistic update
        setSlots(prev => prev.map(s => {
          if (s.id === targetSlot.id) {
            return {
              ...s,
              equipment_id: sourceSlot.equipment_id,
              equipment: sourceSlot.equipment
            };
          }
          if (s.id === sourceSlot.id) {
            return { ...s, equipment_id: null, equipment: null };
          }
          return s;
        }));

        try {
          const updatedTargetSlot = await moveItemBetweenSlots(sourceSlot.id, targetSlot.id);
          
          setSlots(prev => prev.map(s => {
            if (s.id === targetSlot.id) {
              return {
                ...s,
                ...updatedTargetSlot,
                equipment_id: updatedTargetSlot.equipment_id || sourceSlot.equipment_id,
                equipment: updatedTargetSlot.equipment || sourceSlot.equipment
              };
            }
            return s;
          }));

          const prodName = sourceSlot.equipment?.brand ? `${sourceSlot.equipment.brand} (${sourceSlot.equipment.model_number || 'Standard'})` : 'Produk';
          const targetName = targetSlot.room_name || targetSlot.slot_code || 'slot tujuan';
          
          showToast(`${prodName} berhasil dipindahkan ke ${targetName}`, 'success');
          return;
        } catch (err) {
          console.error("Error moving item between slots:", err);
          showToast(err.response?.data?.detail || 'Gagal memindahkan produk ke slot tujuan', 'error');
          // Revert optimistic update
          setSlots([...slots]);
        }
      } else {
        // If filled slot didn't hit a valid target slot, snap back
        setSlots([...slots]);
      }
    } else {
      // Optimistic update for moving empty slot position on floorplan
      setSlots(prev => prev.map(s => s.id === id ? { ...s, position_x: Math.round(x), position_y: Math.round(y) } : s));
      try {
        await updateSlotPosition(id, Math.round(x), Math.round(y));
        showToast('Posisi slot berhasil diperbarui', 'success');
      } catch (err) {
        console.error("Error updating slot position:", err);
        // Revert optimistic update
        setSlots([...slots]);
        showToast('Gagal memperbarui posisi slot', 'error');
      }
    }
  };

  const handleDeleteSlot = async (id) => {
    try {
      await deleteSlot(id);
      setSlots(prev => prev.filter(s => s.id !== id));
      showToast('Slot dihapus', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Gagal menghapus slot', 'error');
    }
  };



  const handleSlotSelect = (slot, eq) => {
    if (eq) {
      setSelectedEquipment(eq);
      setSelectedSlot(slot);
      setActiveModal('equipment_detail');
    } else {
      setSelectedSlot(slot);
      setActiveModal('delete_slot_confirm');
    }
  };

  // Handlers from BottomBar
  const handleManageFloors = () => setActiveModal('floor');
  const handleManageCategories = () => setActiveModal('category');
  const handleManageEquipments = () => {
    if (!currentFloor) {
      showToast('Buat lantai terlebih dahulu', 'warning');
      return;
    }
    setIsEditMode(!isEditMode);
  };

  const handleManageHistory = () => {
    navigate('/history');
  };
  
  const handleExport = async () => {
    try {
      showToast('Mengekspor data ke Excel...', 'info');
      // Using CSV format which can be opened smoothly by Excel
      const response = await api.get('/export/equipments?format=csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'export_spil_denah.csv');
      document.body.appendChild(link);
      link.click();
      
      showToast('Export berhasil diunduh!', 'success');
    } catch (error) {
      showToast('Gagal mengekspor data', 'error');
    }
  };

  const handleCloseModal = async () => {
    setActiveModal(null);
    setSelectedSlot(null);
    setUnassignDate('');
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Failed to refetch categories after closing modal", error);
    }
  };

  // --- Area / Building Operations ---
  const handleCreateBuilding = async (data) => {
    try {
      const newBldg = await createBuilding(data);
      setBuildings([...buildings, newBldg]);
      showToast('Area berhasil ditambahkan', 'success');
    } catch (error) {
      showToast('Gagal menambahkan area', 'error');
    }
  };

  const handleUpdateBuilding = async (id, data) => {
    try {
      const updated = await updateBuilding(id, data);
      setBuildings(buildings.map(b => b.id === id ? { ...b, ...updated } : b));
      if (currentBuilding?.id === id) {
        setCurrentBuilding({ ...currentBuilding, ...updated });
      }
      showToast('Area berhasil diperbarui', 'success');
    } catch (error) {
      showToast('Gagal memperbarui area', 'error');
    }
  };

  const handleDeleteBuilding = async (id) => {
    try {
      await deleteBuilding(id);
      const newBldgs = buildings.filter(b => b.id !== id);
      setBuildings(newBldgs);
      if (currentBuilding?.id === id) {
        if (newBldgs.length > 0) {
          handleSelectBuilding(newBldgs[0].id);
        } else {
          setCurrentBuilding(null);
          setFloors([]);
          setCurrentFloor(null);
          setEquipments([]);
          setSlots([]);
        }
      }
      showToast('Area berhasil dihapus', 'success');
    } catch (error) {
      showToast('Gagal menghapus area', 'error');
    }
  };

  // --- Floor Operations ---
  const handleFloorSubmit = async (data) => {
    if (!currentBuilding) {
      showToast('Pilih gedung terlebih dahulu', 'error');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('name', data.name);
      if (data.file) {
        formData.append('image', data.file);
      }
      
      const newFloor = await createFloor(currentBuilding.id, formData);
      setFloors([...floors, newFloor]);
      handleSelectFloor(newFloor); // Switch to new floor
      
      showToast('Lantai berhasil ditambahkan', 'success');
      // Do not close modal automatically so they can see it in the list, or keep closing if desired.
      // Let's keep it open or just clear form (handled in component)
    } catch (error) {
      showToast('Gagal menambahkan lantai', 'error');
    }
  };

  const handleUpdateFloor = async (id, data) => {
    try {
      const updated = await updateFloor(id, data);
      setFloors(floors.map(f => f.id === id ? { ...f, ...updated } : f));
      if (currentFloor?.id === id) {
        setCurrentFloor({ ...currentFloor, ...updated });
      }
      showToast('Lantai berhasil diperbarui', 'success');
    } catch (error) {
      showToast('Gagal memperbarui lantai', 'error');
    }
  };

  const handleDeleteFloor = async (id) => {
    try {
      await deleteFloor(id);
      const newFloors = floors.filter(f => f.id !== id);
      setFloors(newFloors);
      if (currentFloor?.id === id) {
        if (newFloors.length > 0) {
          handleSelectFloor(newFloors[0]);
        } else {
          setCurrentFloor(null);
          setEquipments([]);
          setSlots([]);
        }
      }
      showToast('Lantai berhasil dihapus', 'success');
    } catch (error) {
      showToast('Gagal menghapus lantai', 'error');
    }
  };

  const handleReorderFloors = async (reorderedFloors) => {
    setFloors(reorderedFloors);
    try {
      // call update API for each floor that changed order (simplified)
      await Promise.all(
        reorderedFloors.map((floor, index) => 
          updateFloor(floor.id, { sort_order: index + 1 })
        )
      );
    } catch (error) {
      showToast('Gagal menyimpan urutan', 'error');
    }
  };

  const handleCategorySubmit = async (data) => {
    try {
      await createCategory({
        name: data.name,
        color: data.color,
        initial_stock: data.initial_stock
      });
      const cats = await getCategories();
      setCategories(cats);
      showToast('Kategori berhasil ditambahkan', 'success');
    } catch (error) {
      showToast(error.response?.data?.detail || 'Gagal menambahkan kategori', 'error');
    }
  };

  const handleUpdateCategory = async (id, data) => {
    try {
      const updated = await updateCategory(id, data);
      const cats = await getCategories();
      setCategories(cats);
      
      // Update the category inside all equipments currently in state so colors sync immediately
      setEquipments(prev => prev.map(eq => {
        if (eq.category_id === id || eq.category?.id === id) {
          return { ...eq, category: { ...eq.category, ...updated } };
        }
        return eq;
      }));

      showToast('Kategori berhasil diperbarui', 'success');
    } catch (error) {
      showToast(error.response?.data?.detail || 'Gagal memperbarui kategori', 'error');
    }
  };

  const handleDeleteCategory = async (id) => {
    const catObj = categories.find(c => c.id === id);
    const isUsed = equipments.some(eq => String(eq.category_id || eq.category?.id) === String(id)) || 
                   slots.some(s => String(s.category_id || s.category?.id) === String(id));

    if (isUsed) {
      setCategoryBlockedNotice(catObj || { id, name: 'Kategori ini' });
      return;
    }

    try {
      await deleteCategory(id);
      setCategories(categories.filter(c => c.id !== id));
      showToast('Kategori berhasil dihapus', 'success');
    } catch (error) {
      setCategoryBlockedNotice(catObj || { id, name: 'Kategori ini' });
    }
  };

  const handleEquipmentSubmit = async (data) => {
    if (!currentFloor) return;
    try {
      const newEqData = {
        ...data,
        position_x: newEqPos.x, 
        position_y: newEqPos.y,
        status: 'active'
      };
      
      const newEq = await createEquipment(currentFloor.id, newEqData);
      
      const catObj = categories.find(c => c.id === newEq.category_id);
      newEq.category = catObj;
      
      setEquipments([...equipments, newEq]);
      
      // Update stats and expiring softly or refetch
      const st = await getEquipmentStats();
      setStats(st);
      const exp = await getExpiringEquipments(30);
      setExpiringEquipments(exp);

      showToast('Barang berhasil disimpan', 'success');
      handleCloseModal();
    } catch (error) {
      showToast('Gagal menambahkan barang', 'error');
    }
  };

  const handleUpdateEquipmentDetail = async (data) => {
    if (!selectedEquipment) return;
    try {
      const updated = await updateEquipment(selectedEquipment.id, data);
      const catObj = categories.find(c => c.id === updated.category_id);
      updated.category = catObj;
      
      setEquipments(equipments.map(eq => eq.id === updated.id ? updated : eq));
      setSelectedEquipment(updated);
      
      const st = await getEquipmentStats();
      setStats(st);
      const exp = await getExpiringEquipments(30);
      setExpiringEquipments(exp);

      showToast('Data barang berhasil diperbarui', 'success');
      setActiveModal('equipment_detail');
    } catch (error) {
      showToast('Gagal memperbarui barang', 'error');
    }
  };

  const handleDeleteEquipmentDetail = async (destination = null) => {
    setConfirmDeleteEq(false);
    
    if (selectedSlot) {
      await handleUnassignItem(selectedSlot.id, destination);
      return;
    }
    
    if (!selectedEquipment) return;
    try {
      const cat = categories.find(c => c.id === selectedEquipment.category_id);
      
      let formattedDate = null;
      if (destination && unassignDate) {
        const d = new Date(unassignDate);
        d.setHours(new Date().getHours());
        d.setMinutes(new Date().getMinutes());
        formattedDate = d.toISOString();
      }

      await deleteEquipment(selectedEquipment.id, destination, formattedDate);
      setEquipments(equipments.filter(eq => eq.id !== selectedEquipment.id));
      
      if (destination === 'good' && cat) {
        updateBrandStockOnUnassign(cat, selectedEquipment.brand, selectedEquipment.model_number);
      }

      if (destination === 'damaged') {
        saveToDamagedInventory(cat, selectedEquipment);
      }

      // refresh categories to update stock
      const cats = await getCategories();
      setCategories(cats);
      
      showToast(
        destination === 'good' 
          ? 'Barang dilepas & stok merk berhasil dikembalikan (+1)' 
          : destination === 'damaged'
          ? 'Barang dimasukkan ke Inventori Rusak'
          : 'Barang berhasil dihapus', 
        'success'
      );
      setActiveModal(null);
      setSelectedEquipment(null);
      setSelectedSlot(null);
    } catch (error) {
      console.error("Error deleting equipment detail:", error);
      showToast(error.response?.data?.detail || error.message || 'Gagal menghapus barang', 'error');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Skeleton variant="card" width="100%" height="100%" />
        </div>
      </MainLayout>
    );
  }

  const currentImageUrl = currentFloor?.floor_plan_image_url 
    ? `/api${currentFloor.floor_plan_image_url.replace('/api', '')}` 
    : (currentFloor ? "https://images.unsplash.com/photo-1600607686527-6fb886090705?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" : "");

  // Filter equipments & slots for Canvas based on selected category
  const canvasEquipments = selectedCategoryId 
    ? equipments.filter(eq => String(eq.category_id || eq.category?.id) === String(selectedCategoryId))
    : equipments;

  const canvasSlots = selectedCategoryId
    ? slots.filter(slot => String(slot.category_id || slot.category?.id) === String(selectedCategoryId))
    : slots;

  const selectedCategoryObj = categories.find(c => String(c.id) === String(selectedCategoryId));

  return (
    <MainLayout
      onManageFloors={handleManageFloors}
      onManageCategories={handleManageCategories}
      onManageEquipments={handleManageEquipments}
      onManageHistory={handleManageHistory}
      onManageInventory={() => navigate('/inventory')}
      onExport={handleExport}
      // Pass states to layout
      buildings={buildings}
      currentBuilding={currentBuilding}
      onSelectBuilding={handleSelectBuilding}
      floors={floors}
      currentFloor={currentFloor}
      onSelectFloor={handleSelectFloor}
      equipments={equipments}
      canvasEquipments={canvasEquipments}
      categories={categories}
      onEquipmentClick={handleEquipmentClick}
      onEquipmentDoubleClick={handleEquipmentDoubleClick}
      highlightedSlotId={highlightedSlotId}
      isEditMode={isEditMode}
      selectedCategoryId={selectedCategoryId}
      onSelectCategory={setSelectedCategoryId}
      slots={slots}
      onDeleteSlot={handleDeleteSlot}
      onSelectMobileSlotTemplate={(cat) => {
        setActiveMobileSlotTemplate(cat);
        showToast(`Slot ${cat.name} dipilih! Tekan 1s pada denah untuk menempatkan.`, 'info');
      }}
    >
      {isEditMode && (
        <div className="edit-mode-banner" style={{
          position: 'absolute',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-success)',
          color: 'white',
          borderRadius: '24px',
          fontWeight: '600',
          fontSize: '0.875rem',
          boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'pulse 2s infinite'
        }}>
          <div style={{ flexShrink: 0, width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />
          <span>Mode Edit Active</span>
        </div>
      )}

      {selectedCategoryObj && (
        <div style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          background: '#ffffff',
          border: `2px solid ${selectedCategoryObj.color || 'var(--color-primary)'}`,
          padding: '8px 16px',
          borderRadius: '20px',
          fontWeight: '700',
          fontSize: '0.875rem',
          color: '#0f172a',
          boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
          zIndex: 15,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: selectedCategoryObj.color || 'var(--color-primary)' }} />
          <span>Kategori: {selectedCategoryObj.name} ({canvasSlots.length} item)</span>
          <button 
            onClick={() => setSelectedCategoryId(null)}
            style={{
              background: 'rgba(0,0,0,0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '0.75rem',
              color: '#64748b'
            }}
            title="Tampilkan Semua Kategori"
          >
            ✕
          </button>
        </div>
      )}

      <FloorCanvas 
        imageUrl={currentImageUrl}
        equipments={currentFloor ? canvasEquipments : []}
        onEquipmentMove={handleEquipmentMove}
        onEquipmentClick={handleEquipmentClick}
        onCanvasClick={handleCanvasClick}
        isEditMode={isEditMode}
        selectedEquipmentId={selectedEquipment?.id}
        highlightedSlotId={highlightedSlotId}
        slots={currentFloor ? canvasSlots : []}
        onSlotDrop={handleSlotDrop}
        onItemDropOnSlot={handleItemDropOnSlot}
        onSlotMove={handleSlotMove}
        onSlotSelect={handleSlotSelect}
        onExport={handleExport}
        activeMobileSlotTemplate={activeMobileSlotTemplate}
        onCancelMobilePlacement={() => setActiveMobileSlotTemplate(null)}
      />

      <Modal 
        isOpen={!!confirmSlotDrop} 
        onClose={() => setConfirmSlotDrop(null)} 
        title="Penempatan Slot Template"
        maxWidth="460px"
      >
        {confirmSlotDrop && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                width: '40px', height: '40px', borderRadius: '50%', 
                background: confirmSlotDrop.category?.color || 'var(--color-primary)', 
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '1.1rem'
              }}>
                {(confirmSlotDrop.category?.name || 'S').charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                  Slot Kategori: {confirmSlotDrop.category?.name}
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  Gedung: {currentBuilding?.name || '-'} | {currentFloor?.name || '-'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                Lokasi Ruangan / Room Name *
              </label>
              <input 
                type="text"
                placeholder="Contoh: Ruang Meeting A, Kamar Utama, Lobby, Gudang..."
                value={confirmSlotDrop.roomName || ''}
                onChange={(e) => setConfirmSlotDrop({ ...confirmSlotDrop, roomName: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmCreateSlot();
                  }
                }}
                style={{ 
                  width: '100%', 
                  padding: '10px 14px', 
                  borderRadius: '10px', 
                  border: '1px solid var(--color-border)', 
                  outline: 'none',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)',
                  background: 'var(--color-bg)'
                }}
                autoFocus
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Nama ruangan ini akan tercantum di Detail Barang & Log History.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button 
                onClick={() => setConfirmSlotDrop(null)}
                style={{ 
                  padding: '8px 16px', borderRadius: '8px', border: 'none', 
                  background: 'transparent', color: 'var(--color-text-secondary)', 
                  cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem' 
                }}
              >
                Batal
              </button>
              <button 
                onClick={confirmCreateSlot}
                style={{ 
                  padding: '8px 20px', borderRadius: '8px', border: 'none', 
                  background: 'var(--color-primary)', color: 'white', 
                  cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem',
                  boxShadow: '0 4px 12px rgba(58, 149, 66, 0.3)'
                }}
              >
                Tempatkan Slot
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal 
        isOpen={!!confirmAssignItem} 
        onClose={() => setConfirmAssignItem(null)} 
        title="Pilih Merk & Tipe Barang"
        maxWidth="500px"
      >
        {confirmAssignItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '14px', 
              background: 'var(--color-bg-secondary)', padding: '12px 16px', borderRadius: '12px' 
            }}>
              <div style={{ 
                width: '42px', height: '42px', borderRadius: '50%', 
                background: confirmAssignItem.category?.color || 'var(--color-primary)', 
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '1.2rem'
              }}>
                {(confirmAssignItem.category?.name || 'B').charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                  {confirmAssignItem.category?.name}
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: '600' }}>
                  Lokasi Ruang: {confirmAssignItem.slot?.room_name || 'Ruang Utama'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                Pilih Merk / Tipe Terdaftar:
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {confirmAssignItem.categoryBrands.map((bItem, idx) => {
                  const isSelected = !confirmAssignItem.isCustom && 
                    confirmAssignItem.selectedBrand === bItem.brand && 
                    confirmAssignItem.selectedModel === bItem.model_number;

                  const isOutOfStock = bItem.stock === 0;

                  return (
                    <div 
                      key={idx}
                      onClick={() => {
                        if (!isOutOfStock) {
                          setConfirmAssignItem({
                            ...confirmAssignItem,
                            isCustom: false,
                            selectedBrand: bItem.brand,
                            selectedModel: bItem.model_number || ''
                          });
                        }
                      }}
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: '10px',
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: isSelected ? 'rgba(58, 149, 66, 0.08)' : (isOutOfStock ? '#f3f4f6' : 'var(--color-bg)'),
                        cursor: isOutOfStock ? 'not-allowed' : 'pointer', 
                        transition: 'all 0.2s ease',
                        opacity: isOutOfStock ? 0.6 : 1
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                          type="radio" 
                          checked={isSelected}
                          disabled={isOutOfStock}
                          onChange={() => {}}
                          style={{ accentColor: 'var(--color-primary)', cursor: isOutOfStock ? 'not-allowed' : 'pointer' }}
                        />
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                            {bItem.brand}
                          </strong>
                          {bItem.model_number && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                              ({bItem.model_number})
                            </span>
                          )}
                        </div>
                      </div>
                      {bItem.stock !== undefined && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>
                          Stok: {bItem.stock}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Option Custom */}
                <div 
                  onClick={() => setConfirmAssignItem({ ...confirmAssignItem, isCustom: true })}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '10px',
                    border: confirmAssignItem.isCustom ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: confirmAssignItem.isCustom ? 'rgba(58, 149, 66, 0.08)' : 'var(--color-bg)',
                    cursor: 'pointer'
                  }}
                >
                  <input 
                    type="radio" 
                    checked={confirmAssignItem.isCustom}
                    onChange={() => {}}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>
                    + Input Merk & Tipe Manual / Lainnya
                  </span>
                </div>
              </div>
            </div>

            {confirmAssignItem.isCustom && (
              <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--color-bg-secondary)', padding: '12px', borderRadius: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                    Nama Merk *
                  </label>
                  <input 
                    type="text" 
                    placeholder="Panasonic, Miyako..."
                    value={confirmAssignItem.customBrand}
                    onChange={(e) => setConfirmAssignItem({ ...confirmAssignItem, customBrand: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        confirmAssignEquipmentToSlot();
                      }
                    }}
                    style={{ 
                      width: '100%', padding: '8px 12px', borderRadius: '8px', 
                      border: '1px solid var(--color-border)', outline: 'none', fontSize: '0.875rem' 
                    }}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                    Tipe / Model
                  </label>
                  <input 
                    type="text" 
                    placeholder="Standard 1PK, Stand Fan..."
                    value={confirmAssignItem.customModel}
                    onChange={(e) => setConfirmAssignItem({ ...confirmAssignItem, customModel: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        confirmAssignEquipmentToSlot();
                      }
                    }}
                    style={{ 
                      width: '100%', padding: '8px 12px', borderRadius: '8px', 
                      border: '1px solid var(--color-border)', outline: 'none', fontSize: '0.875rem' 
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button 
                onClick={() => setConfirmAssignItem(null)}
                style={{ 
                  padding: '8px 16px', borderRadius: '8px', border: 'none', 
                  background: 'transparent', color: 'var(--color-text-secondary)', 
                  cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem' 
                }}
              >
                Batal
              </button>
              <button 
                onClick={confirmAssignEquipmentToSlot}
                disabled={!confirmAssignItem.isCustom && (() => {
                  const b = confirmAssignItem.categoryBrands.find(cb => cb.brand === confirmAssignItem.selectedBrand && cb.model_number === confirmAssignItem.selectedModel);
                  return b && b.stock === 0;
                })()}
                style={{ 
                  padding: '8px 20px', borderRadius: '8px', border: 'none', 
                  background: 'var(--color-primary)', color: 'white', 
                  cursor: (!confirmAssignItem.isCustom && (() => {
                    const b = confirmAssignItem.categoryBrands.find(cb => cb.brand === confirmAssignItem.selectedBrand && cb.model_number === confirmAssignItem.selectedModel);
                    return b && b.stock === 0;
                  })()) ? 'not-allowed' : 'pointer', 
                  fontWeight: '600', fontSize: '0.875rem',
                  boxShadow: '0 4px 12px rgba(58, 149, 66, 0.3)',
                  opacity: (!confirmAssignItem.isCustom && (() => {
                    const b = confirmAssignItem.categoryBrands.find(cb => cb.brand === confirmAssignItem.selectedBrand && cb.model_number === confirmAssignItem.selectedModel);
                    return b && b.stock === 0;
                  })()) ? 0.5 : 1
                }}
              >
                Pasang Barang
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={activeModal === 'floor'} onClose={handleCloseModal} title="Manajemen Area & Lantai" maxWidth="900px">
        <AreaManagement 
          buildings={buildings}
          floors={floors}
          currentBuilding={currentBuilding}
          onCreateBuilding={handleCreateBuilding}
          onUpdateBuilding={handleUpdateBuilding}
          onDeleteBuilding={handleDeleteBuilding}
          onSelectBuilding={handleSelectBuilding}
          onCreateFloor={handleFloorSubmit} 
          onUpdateFloor={handleUpdateFloor}
          onDeleteFloor={handleDeleteFloor}
          onReorderFloors={handleReorderFloors}
          onCancel={handleCloseModal} 
        />
      </Modal>

      <Modal isOpen={activeModal === 'inventory' || activeModal === 'category'} onClose={handleCloseModal} title="Manajemen Inventori & Kategori" maxWidth="900px">
        <InventoryManagement 
          onClose={handleCloseModal} 
          initialTab={activeModal === 'category' ? 'category' : inventoryInitialTab} 
          categories={categories}
          onCategorySubmit={handleCategorySubmit}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
        />
      </Modal>

      <Modal isOpen={activeModal === 'equipment_detail' && selectedEquipment} onClose={handleCloseModal} title="Detail Barang & Lokasi" maxWidth="620px">
        {selectedEquipment && (() => {
          const slot = selectedSlot || slots.find(s => s.equipment_id === selectedEquipment.id || s.equipment?.id === selectedEquipment.id);
          const slotCode = slot?.slot_code || selectedEquipment?.slot_code;
          const catColor = slot?.category?.color || selectedEquipment.category?.color || '#3b82f6';
          const catName = slot?.category?.name || selectedEquipment.category?.name;
          
          let purchaseDateStr = '-';
          let expiredDateStr = '-';
          try {
            const savedBrands = localStorage.getItem('spil_category_brands');
            if (savedBrands) {
              const map = JSON.parse(savedBrands);
              const catKey = (catName || '').toLowerCase();
              const catBrands = map[catKey] || map[selectedEquipment.category_id] || [];
              const brandObj = catBrands.find(b => 
                (b.brand || '').toLowerCase() === (selectedEquipment.brand || '').toLowerCase() &&
                (b.model_number || '').toLowerCase() === (selectedEquipment.model_number || '').toLowerCase()
              );
              if (brandObj) {
                if (brandObj.purchase_date) {
                  const d = new Date(brandObj.purchase_date);
                  if (!isNaN(d)) {
                    purchaseDateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  } else {
                    purchaseDateStr = brandObj.purchase_date;
                  }
                }
                if (brandObj.expired_date) {
                  const ed = new Date(brandObj.expired_date);
                  if (!isNaN(ed)) {
                    expiredDateStr = ed.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  } else {
                    expiredDateStr = brandObj.expired_date;
                  }
                }
              }
            }
          } catch(e) {}

          return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', background: 'rgba(255,255,255,0.6)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ 
                width: '52px', height: '52px', borderRadius: '12px', 
                background: `${catColor}20`, 
                color: catColor, 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.6rem', fontWeight: 'bold',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
              }}>
                {catName ? catName.charAt(0).toUpperCase() : 'B'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--color-text-primary)', fontWeight: '700' }}>
                    {selectedEquipment.name}
                  </h3>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}40` }}>
                    {catName || 'Barang'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {slotCode && (
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', padding: '4px 10px', borderRadius: '8px', background: 'rgba(58, 149, 66, 0.12)', color: 'var(--color-primary)', border: '1px solid rgba(58, 149, 66, 0.3)' }}>
                      ID Tempat: <strong>{slotCode}</strong>
                    </span>
                  )}
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', padding: '4px 10px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.3)' }}>
                    ID Barang: <strong>{selectedEquipment.name}</strong>
                  </span>
                </div>
              </div>
            </div>
            
            <div className="neu-inset mobile-grid-1" style={{ padding: '18px', borderRadius: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.5)', padding: '12px 14px', borderRadius: '10px' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                  ID TEMPAT (SLOT)
                </p>
                <p style={{ margin: '6px 0 0', fontWeight: '800', color: 'var(--color-primary)', fontSize: '1.05rem' }}>
                  {slotCode || '-'}
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.5)', padding: '12px 14px', borderRadius: '10px' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                  ID BARANG (ASET)
                </p>
                <p style={{ margin: '6px 0 0', fontWeight: '800', color: '#2563eb', fontSize: '1.05rem' }}>
                  {selectedEquipment.name}
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.5)', padding: '12px 14px', borderRadius: '10px' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                  MERK & TIPE
                </p>
                <p style={{ margin: '6px 0 0', fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>
                  {selectedEquipment?.brand || '-'} {selectedEquipment?.model_number ? `(${selectedEquipment.model_number})` : ''}
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.5)', padding: '12px 14px', borderRadius: '10px' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                  RUANGAN / ROOM
                </p>
                <p style={{ margin: '6px 0 0', fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>
                  {slot?.room_name || selectedEquipment?.room_name || slot?.room || 'Ruang Utama'}
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.5)', padding: '12px 14px', borderRadius: '10px' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                  TANGGAL PEMBELIAN
                </p>
                <p style={{ margin: '6px 0 0', fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>
                  {purchaseDateStr}
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.5)', padding: '12px 14px', borderRadius: '10px' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                  LOKASI & AREA DENAH
                </p>
                <p style={{ margin: '6px 0 0', fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>
                  {currentBuilding?.name || 'Gedung Utama'} — {currentFloor?.name || 'Lantai 1'}
                </p>
              </div>

              {expiredDateStr !== '-' && (
                <div style={{ background: 'rgba(255, 255, 255, 0.5)', padding: '12px 14px', borderRadius: '10px' }}>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                    TANGGAL KEDALUWARSA
                  </p>
                  <p style={{ margin: '6px 0 0', fontWeight: '700', color: 'var(--color-danger)', fontSize: '0.95rem' }}>
                    {expiredDateStr}
                  </p>
                </div>
              )}
            </div>
            
            
            {/* KONDISI ASET - KHUSUS PERMANENT (BER-ID) */}
            {(selectedSlot?.category?.has_id || selectedEquipment?.category?.has_id || categories.find(c => c.id === selectedEquipment?.category_id)?.has_id) && (
              <div className="neu-inset" style={{ padding: '16px', borderRadius: '12px', marginTop: '16px' }}>
                <p style={{ margin: '0 0 12px', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)' }}>Kondisi Aset</p>
                <div className="mobile-col" style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleUpdateEquipmentStatus(selectedEquipment.id, 'active')}
                    className="neu-raised-sm"
                    style={{ 
                      flex: 1, padding: '8px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500',
                      background: selectedEquipment.status === 'active' || !selectedEquipment.status ? 'var(--color-success)' : 'var(--color-bg)',
                      color: selectedEquipment.status === 'active' || !selectedEquipment.status ? 'white' : 'var(--color-text-secondary)',
                    }}
                  >Baik</button>
                  <button 
                    onClick={() => handleUpdateEquipmentStatus(selectedEquipment.id, 'warning')}
                    className="neu-raised-sm"
                    style={{ 
                      flex: 1, padding: '8px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500',
                      background: selectedEquipment.status === 'warning' ? 'var(--color-warning)' : 'var(--color-bg)',
                      color: selectedEquipment.status === 'warning' ? 'white' : 'var(--color-text-secondary)',
                    }}
                  >Perlu Cek</button>
                  <button 
                    onClick={() => handleUpdateEquipmentStatus(selectedEquipment.id, 'damaged')}
                    className="neu-raised-sm"
                    style={{ 
                      flex: 1, padding: '8px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500',
                      background: selectedEquipment.status === 'damaged' ? 'var(--color-danger)' : 'var(--color-bg)',
                      color: selectedEquipment.status === 'damaged' ? 'white' : 'var(--color-text-secondary)',
                    }}
                  >Rusak</button>
                </div>
                
                {selectedEquipment.status === 'damaged' && (
                  <button
                    onClick={() => {
                      if (selectedSlot) setActiveModal('unassign_destination');
                      else setActiveModal('delete_equipment_destination');
                    }}
                    className="neu-raised"
                    style={{ 
                      width: '100%', padding: '8px', border: '1px dashed var(--color-danger)', borderRadius: '8px', 
                      cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-danger)',
                      background: 'rgba(239, 68, 68, 0.1)', marginTop: '12px' 
                    }}
                  >
                    Tarik ke Gudang / Hapus
                  </button>
                )}
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              {isEditMode ? (
                <button 
                  onClick={() => {
                    if (selectedSlot) {
                      setActiveModal('unassign_destination');
                    } else if (selectedEquipment) {
                      setActiveModal('delete_equipment_destination');
                    }
                  }}
                  className="neu-raised" 
                  style={{ padding: '8px 16px', border: 'none', background: 'transparent', color: 'var(--color-danger)', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  {selectedSlot ? 'Hapus dari template' : 'Hapus'}
                </button>
              ) : <div></div>}
              <button 
                onClick={handleCloseModal}
                className="neu-raised" 
                style={{ padding: '8px 24px', border: 'none', background: 'transparent', color: 'var(--color-primary)', fontWeight: '600', cursor: 'pointer' }}
              >
                Tutup
              </button>
            </div>
          </div>
        );})()}
      </Modal>



      <Modal 
        isOpen={activeModal === 'unassign_destination' || activeModal === 'delete_equipment_destination'} 
        onClose={() => setActiveModal('equipment_detail')} 
        title="Status & Tujuan Pelepasan Barang"
      >
        <div style={{ padding: '8px' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '12px' }}>
            Kemana Anda ingin memindahkan barang ini dari template denah? Status akan langsung terhubung ke <strong>History Log</strong>.
          </p>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)', marginBottom: '8px' }}>
              Tanggal Pelepasan / Pembaruan:
            </label>
            <input 
              type="date" 
              value={unassignDate}
              onChange={(e) => setUnassignDate(e.target.value)}
              className="neu-inset"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: 'none', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem' }}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              className="neu-inset"
              onClick={() => {
                if (selectedSlot) handleUnassignItem(selectedSlot.id, 'good');
                else if (selectedEquipment) handleDeleteEquipmentDetail('good');
              }}
              style={{ 
                padding: '14px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px', 
                cursor: 'pointer', textAlign: 'left', border: '1px solid rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.05)' 
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', flexShrink: 0 }}>✓</div>
              <div>
                <span style={{ fontWeight: '700', color: '#15803d', fontSize: '0.95rem' }}>Masuk Inventori Baru (Stok Siap Pakai)</span>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Barang masih baik & stok bertambah di Inventori Baru / Riwayat.</p>
              </div>
            </button>

            <button 
              className="neu-inset"
              onClick={() => {
                if (selectedSlot) handleUnassignItem(selectedSlot.id, 'damaged');
                else if (selectedEquipment) handleDeleteEquipmentDetail('damaged');
              }}
              style={{ 
                padding: '14px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px', 
                cursor: 'pointer', textAlign: 'left', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)' 
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', flexShrink: 0 }}></div>
              <div>
                <span style={{ fontWeight: '700', color: '#b45309', fontSize: '0.95rem' }}>Masuk Inventori Rusak (Perbaikan)</span>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Barang perlu servis dan dicatat sebagai barang rusak di Riwayat.</p>
              </div>
            </button>

            <button 
              className="neu-inset"
              onClick={() => {
                if (selectedSlot) handleUnassignItem(selectedSlot.id, 'discard');
                else if (selectedEquipment) handleDeleteEquipmentDetail('discard');
              }}
              style={{ 
                padding: '14px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px', 
                cursor: 'pointer', textAlign: 'left', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' 
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', flexShrink: 0 }}>✕</div>
              <div>
                <span style={{ fontWeight: '700', color: '#b91c1c', fontSize: '0.95rem' }}>Dibuang / Hapus Permanen</span>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Barang sudah tidak layak dan dicatat sebagai dibuang.</p>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={activeModal === 'delete_slot_confirm'}
        onClose={() => { setActiveModal(null); setSelectedSlot(null); }}
        onConfirm={() => {
          if (selectedSlot) handleDeleteSlot(selectedSlot.id);
          setActiveModal(null);
          setSelectedSlot(null);
        }}
        title="Hapus Titik Slot"
        message="Apakah Anda yakin ingin menghapus titik slot kosong ini?"
      />

      <ConfirmModal 
        isOpen={confirmDeleteEq}
        onClose={() => setConfirmDeleteEq(false)}
        onConfirm={handleDeleteEquipmentDetail}
        title="Hapus Barang"
        message="Apakah Anda yakin ingin menghapus barang ini? Data yang telah dihapus tidak dapat dikembalikan."
      />

      <Modal 
        isOpen={warrantyConfirm !== null} 
        onClose={() => setWarrantyConfirm(null)} 
        title={`Peringatan Masa Garansi (< ${warrantyConfirm?.warrantyMonths >= 12 ? Math.floor(warrantyConfirm.warrantyMonths / 12) + ' Tahun' : warrantyConfirm?.warrantyMonths + ' Bulan'})`}
        maxWidth="500px"
      >
        {warrantyConfirm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
            
            {/* Banner */}
            <div style={{ 
              background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '12px', 
              padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start' 
            }}>
              <div style={{ 
                width: '40px', height: '40px', borderRadius: '50%', background: '#ea580c', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0
              }}>
                <ShieldAlert size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, color: '#9a3412', fontSize: '1rem', fontWeight: '800' }}>MASIH DALAM MASA GARANSI!</h4>
                <p style={{ margin: '4px 0 0', color: '#c2410c', fontSize: '0.875rem', lineHeight: '1.4' }}>
                  Barang ini baru dipasang pada <strong>{warrantyConfirm.installDateStr}</strong> (berusia kurang dari {warrantyConfirm.warrantyMonths >= 12 ? Math.floor(warrantyConfirm.warrantyMonths / 12) + ' tahun' : warrantyConfirm.warrantyMonths + ' bulan'} / {warrantyConfirm.warrantyMonths * 30} hari).
                </p>
              </div>
            </div>

            {/* Detail Card */}
            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>ID Barang / Nama:</span>
                <span style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '600' }}>{warrantyConfirm.eqName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Merk & Tipe:</span>
                <span style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '600' }}>{warrantyConfirm.brand} {warrantyConfirm.modelNumber ? `(${warrantyConfirm.modelNumber})` : ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Telah Dipakai Selama:</span>
                <span style={{ background: '#ffedd5', color: '#ea580c', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: '700' }}>
                  {warrantyConfirm.usageDays} hari ({warrantyConfirm.usageMonths} bulan)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Batas Garansi (Vendor):</span>
                <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: '700' }}>
                  {warrantyConfirm.warrantyMonths * 30} hari ({warrantyConfirm.warrantyMonths} bulan)
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', lineHeight: '1.4' }}>
              <span style={{ background: '#3b82f6', color: 'white', padding: '0 6px', borderRadius: '4px', height: 'fit-content', fontWeight: 'bold' }}>i</span>
              Jika barang ini rusak atau diganti, Anda disarankan mencatatnya untuk klaim garansi vendor sebelum menghapusnya secara permanen.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button 
                onClick={() => setWarrantyConfirm(null)}
                style={{ background: 'transparent', color: 'var(--color-text-secondary)', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  handleUnassignItem(warrantyConfirm.slotId, warrantyConfirm.destination);
                  setWarrantyConfirm(null);
                }}
                style={{ background: '#ea580c', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Tetap Copot / Klaim Garansi
              </button>
            </div>
          </div>
        )}
      {/* Blocked Category Notice Modal */}
      {categoryBlockedNotice && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '24px', padding: '28px 32px',
            maxWidth: '480px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '2px solid #fee2e2', display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', gap: '16px'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#fee2e2', color: '#dc2626', border: '3px solid #fca5a5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)'
            }}>
              <AlertTriangle size={32} />
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.35rem', fontWeight: '900', color: '#991b1b' }}>
                Kategori Tidak Dapat Dihapus!
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', lineHeight: '1.5' }}>
                Kategori <span style={{ color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: '6px', border: '1px solid #fecaca' }}>"{categoryBlockedNotice.name}"</span> masih terpasang di denah lokasi.
              </p>
            </div>

            <div style={{
              background: '#f8fafc', padding: '14px 16px', borderRadius: '12px',
              border: '1.5px dashed #cbd5e1', fontSize: '0.85rem', color: '#334155',
              textAlign: 'left', width: '100%', lineHeight: '1.5'
            }}>
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>⚠️ Mengapa tidak bisa dihapus?</strong>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                <li>Terdapat barang/slot aktif kategori <strong>{categoryBlockedNotice.name}</strong> yang terpasang pada denah lokasi.</li>
                <li>Silakan lepaskan atau hapus semua barang kategori <strong>{categoryBlockedNotice.name}</strong> yang ada di denah terlebih dahulu sebelum menghapus kategori ini.</li>
              </ul>
            </div>

            <button
              onClick={() => setCategoryBlockedNotice(null)}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px',
                background: '#dc2626', color: '#ffffff', border: 'none',
                fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
      </Modal>
    </MainLayout>
  );
};

export default DashboardPage;
