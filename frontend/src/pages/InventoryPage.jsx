import React, { useState, useEffect } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/categories';
import { getAllEquipments } from '../api/equipments';
import { getInventoryLogs, addStockToInventory, getAssets, restoreAsset, deleteAsset } from '../api/inventory';
import { useToast } from '../contexts/ToastContext';
import { Search, Package, PackageX, Wrench, Trash2, ArrowLeft, Plus, Check, X, MapPin, History, Tag, Edit2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/UI/ConfirmModal';

const InventoryPage = () => {
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('good'); // 'good', 'damaged'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryView, setSelectedCategoryView] = useState(null);
  const [selectedBrandDetail, setSelectedBrandDetail] = useState(null);
  
  // Data States
  const [brandInventory, setBrandInventory] = useState([]);
  const [damagedInventory, setDamagedInventory] = useState([]);
  const [activeEquipments, setActiveEquipments] = useState([]);
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(50);
  
  // Modal Category states
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [editingCategoryModal, setEditingCategoryModal] = useState(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  const [categoryBlockedNotice, setCategoryBlockedNotice] = useState(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#3a9542');
  const [catHasId, setCatHasId] = useState(true);

  // Modal Add Brand / Variant state
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [brandForm, setBrandForm] = useState({
    brand: '',
    model_number: '',
    stock: '1',
    min_stock: '1',
    warranty_months: '0'
  });

  // Stock & Damaged modals
  const [addStockModal, setAddStockModal] = useState(null);
  const [stockToAdd, setStockToAdd] = useState(1);
  const [confirmDeleteDamaged, setConfirmDeleteDamaged] = useState(null);
  const [confirmDeleteBrand, setConfirmDeleteBrand] = useState(null);
  const [itemHistoryModal, setItemHistoryModal] = useState(null);

  const handleDeleteBrand = (item, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    console.log("Delete brand triggered for:", item);
    setConfirmDeleteBrand(item);
  };

  const confirmDeleteBrandAction = async () => {
    if (!confirmDeleteBrand) return;
    const item = confirmDeleteBrand;
    const catName = selectedCategoryView?.name || item.category_name || 'Item';
    const catId = selectedCategoryView?.id || item.category_id;
    const catColor = selectedCategoryView?.color || item.category_color || '#3b82f6';
    const stockQty = parseInt(item.stock) || 1;

    try {
      // 1. Remove brand item from spil_category_brands localStorage across ALL keys
      const savedBrands = localStorage.getItem('spil_category_brands');
      if (savedBrands) {
        let map = JSON.parse(savedBrands);
        Object.keys(map).forEach(key => {
          if (Array.isArray(map[key])) {
            map[key] = map[key].filter(b => {
              const brandMatch = (b.brand || '').toLowerCase().trim() === (item.brand || '').toLowerCase().trim();
              const modelMatch = (b.model_number || '').toLowerCase().trim() === (item.model_number || '').toLowerCase().trim();
              const idMatch = b.id && item.id && String(b.id) === String(item.id);
              return !(idMatch || (brandMatch && modelMatch));
            });
          }
        });
        localStorage.setItem('spil_category_brands', JSON.stringify(map));
      }

      // 2. Format batch asset ID string: e.g. "Lampu-1 -- 32" as requested by user
      const assetIdLabel = stockQty > 1 
        ? `${catName}-1 -- ${stockQty}` 
        : `${catName}-1`;

      // 3. Save log entry to both spil_local_history_logs and spil_local_logs
      const newLog = {
        id: 'log_' + Date.now(),
        category_id: catId,
        category_name: catName,
        category: {
          id: catId,
          name: catName,
          color: catColor
        },
        asset_id: assetIdLabel,
        brand: item.brand,
        model_number: item.model_number || 'Standard',
        action_type: 'remove',
        status: 'Dibuang / Dihapus (stok dibuang/dihapus)',
        quantity: stockQty,
        qty: stockQty,
        building_name: '-',
        floor_name: '-',
        room_name: '-',
        location_info: 'Gudang (Stok dibuang/dihapus)',
        notes: '(stok dibuang/dihapus)',
        created_at: new Date().toISOString()
      };

      try {
        const savedHistory = localStorage.getItem('spil_local_history_logs');
        const histLogs = savedHistory ? JSON.parse(savedHistory) : [];
        histLogs.unshift(newLog);
        localStorage.setItem('spil_local_history_logs', JSON.stringify(histLogs));
      } catch (e) { console.error('History log save error:', e); }

      try {
        const savedLogs = localStorage.getItem('spil_local_logs');
        const locLogs = savedLogs ? JSON.parse(savedLogs) : [];
        locLogs.unshift(newLog);
        localStorage.setItem('spil_local_logs', JSON.stringify(locLogs));
      } catch (e) { console.error('Local log save error:', e); }

      // 4. Directly update local state so card disappears immediately
      setBrandInventory(prev => prev.filter(b => {
        const brandMatch = (b.brand || '').toLowerCase().trim() === (item.brand || '').toLowerCase().trim();
        const modelMatch = (b.model_number || '').toLowerCase().trim() === (item.model_number || '').toLowerCase().trim();
        const idMatch = b.id && item.id && String(b.id) === String(item.id);
        return !(idMatch || (brandMatch && modelMatch));
      }));

      showToast(`Merk ${item.brand} (${stockQty} unit) berhasil dibuang & dicatat dalam riwayat log`, 'success');
      setConfirmDeleteBrand(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      showToast('Gagal membuang stok barang', 'error');
    }
  };
  
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setVisibleCount(50);
  }, [selectedBrandDetail]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const cats = await getCategories();
      setCategories(cats);
      
      // Load Good Inventory
      const savedBrands = localStorage.getItem('spil_category_brands');
      let flatBrands = [];
      if (savedBrands) {
        const map = JSON.parse(savedBrands);
        cats.forEach(cat => {
          const catKey = (cat.name || '').toLowerCase();
          const brands = map[catKey] || map[cat.id] || [];
          brands.forEach(b => {
            flatBrands.push({
              ...b,
              category_id: cat.id,
              category_name: cat.name,
              category_color: cat.color || '#3b82f6'
            });
          });
        });
      }
      setBrandInventory(flatBrands);

      // Load Damaged Inventory
      const savedDamaged = localStorage.getItem('spil_damaged_inventory');
      let localDamaged = savedDamaged ? JSON.parse(savedDamaged) : [];

      try {
        const damagedAssets = await getAssets('damaged');
        if (damagedAssets && Array.isArray(damagedAssets)) {
          const apiDamaged = damagedAssets.map(a => ({
            id: a.id,
            asset_id: a.asset_id || a.name || `AST-${a.id}`,
            brand: a.brand || 'Tanpa Merk',
            model_number: a.model_number || 'Standard',
            category_id: a.category_id,
            category_name: a.category_name || 'Umum',
            unassigned_at: a.updated_at || a.created_at || new Date().toISOString()
          }));
          
          const existingIds = new Set(localDamaged.map(d => String(d.asset_id || d.id)));
          apiDamaged.forEach(ad => {
            if (!existingIds.has(String(ad.asset_id)) && !existingIds.has(String(ad.id))) {
              localDamaged.push(ad);
            }
          });
        }
      } catch (err) {
        console.log("Could not fetch API damaged assets:", err);
      }

      setDamagedInventory(localDamaged);
      
      // Load Active Equipments
      const eqs = await getAllEquipments();
      setActiveEquipments(eqs || []);
      
      // Load History Logs
      const logs = await getInventoryLogs();
      setInventoryLogs(logs || []);
      
      // Load Available Assets
      const assets = await getAssets('available');
      setAvailableAssets(assets || []);
      
    } catch (e) {
      console.error(e);
      showToast('Gagal memuat data inventori', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddCategoryModal = () => {
    setEditingCategoryModal(null);
    setCatName('');
    setCatColor('#3a9542');
    setCatHasId(true);
    setShowAddCategoryModal(true);
  };

  const handleOpenEditCategoryModal = (cat, e) => {
    e.stopPropagation();
    setEditingCategoryModal(cat);
    setCatName(cat.name);
    setCatColor(cat.color || '#3a9542');
    setCatHasId(cat.has_id || false);
    setShowAddCategoryModal(true);
  };

  const handleModalCategorySubmit = async (e) => {
    e.preventDefault();
    if (!catName.trim()) {
      showToast('Nama kategori wajib diisi', 'error');
      return;
    }

    try {
      if (editingCategoryModal) {
        await updateCategory(editingCategoryModal.id, {
          name: catName,
          color: catColor,
          has_id: catHasId
        });
        showToast('Kategori berhasil diperbarui!', 'success');
      } else {
        await createCategory({
          name: catName,
          color: catColor,
          initial_stock: 0,
          minimum_stock: 0,
          has_id: catHasId
        });
        showToast('Kategori berhasil ditambahkan!', 'success');
      }
      setShowAddCategoryModal(false);
      setEditingCategoryModal(null);
      fetchData();
    } catch (err) {
      showToast('Gagal menyimpan kategori', 'error');
    }
  };

  const handleDeleteCategoryConfirm = async () => {
    if (!confirmDeleteCategory) return;
    const catToBlock = confirmDeleteCategory;
    
    // Check if category has active equipments/items placed in denah
    const isUsedInDenah = activeEquipments.some(eq => 
      String(eq.category_id || eq.category?.id) === String(catToBlock.id) || 
      (eq.category_name || '').toLowerCase() === (catToBlock.name || '').toLowerCase()
    );

    if (isUsedInDenah) {
      setConfirmDeleteCategory(null);
      setCategoryBlockedNotice(catToBlock);
      return;
    }

    try {
      await deleteCategory(catToBlock.id);
      showToast('Kategori berhasil dihapus!', 'success');
      setConfirmDeleteCategory(null);
      fetchData();
    } catch (err) {
      setConfirmDeleteCategory(null);
      setCategoryBlockedNotice(catToBlock);
    }
  };

  const handleOpenAddBrandModal = () => {
    setBrandForm({
      brand: '',
      model_number: '',
      stock: '1',
      min_stock: '1',
      warranty_months: '0'
    });
    setShowAddBrandModal(true);
  };

  const handleAddBrandSubmit = async (e) => {
    e.preventDefault();
    if (!brandForm.brand.trim()) {
      showToast('Nama Merk wajib diisi', 'error');
      return;
    }
    if (!selectedCategoryView) {
      showToast('Pilih kategori terlebih dahulu', 'error');
      return;
    }

    try {
      const saved = localStorage.getItem('spil_category_brands');
      let map = saved ? JSON.parse(saved) : {};

      const catKey = (selectedCategoryView.name || '').toLowerCase();
      const catId = selectedCategoryView.id;
      const currentBrands = map[catKey] || map[catId] || [];

      const newBrandItem = {
        id: 'b_' + Date.now(),
        brand: brandForm.brand.trim(),
        model_number: brandForm.model_number.trim() || 'Standard',
        stock: parseInt(brandForm.stock) || 0,
        min_stock: parseInt(brandForm.min_stock) || 0,
        warranty_months: parseInt(brandForm.warranty_months) || 0
      };

      const updatedBrands = [...currentBrands, newBrandItem];
      map[catKey] = updatedBrands;
      if (catId) map[catId] = updatedBrands;

      localStorage.setItem('spil_category_brands', JSON.stringify(map));

      // Record Activity Log for adding new stock item
      if (newBrandItem.stock > 0) {
        let apiSuccess = false;
        try {
          await addStockToInventory({
            category_id: selectedCategoryView.id,
            brand: newBrandItem.brand,
            model_number: newBrandItem.model_number,
            quantity: newBrandItem.stock
          });
          apiSuccess = true;
        } catch (apiErr) {
          console.log("Backend API addStock notice:", apiErr);
        }

        if (!apiSuccess) {
          const savedLogs = localStorage.getItem('spil_local_logs');
          const localLogs = savedLogs ? JSON.parse(savedLogs) : [];
          localLogs.unshift({
            id: 'log_' + Date.now(),
            category_id: selectedCategoryView.id,
            category_name: selectedCategoryView.name,
            category: { id: selectedCategoryView.id, name: selectedCategoryView.name },
            brand: newBrandItem.brand,
            model_number: newBrandItem.model_number,
            action_type: 'add_stock',
            quantity: newBrandItem.stock,
            status: 'Siap Pakai',
            location_info: `Stok Masuk Gudang (${selectedCategoryView.name})`,
            created_at: new Date().toISOString()
          });
          localStorage.setItem('spil_local_logs', JSON.stringify(localLogs));
        }
      }

      showToast(`Berhasil menambah barang ${newBrandItem.brand}!`, 'success');
      setShowAddBrandModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Gagal menambahkan barang', 'error');
    }
  };



  const handleAddStockSubmit = async (e) => {
    e.preventDefault();
    if (!addStockModal || stockToAdd <= 0) return;
    
    try {
      let apiSuccess = false;
      try {
        await addStockToInventory({
          category_id: addStockModal.category_id,
          brand: addStockModal.brand,
          model_number: addStockModal.model_number || 'Standard',
          quantity: parseInt(stockToAdd)
        });
        apiSuccess = true;
      } catch (apiErr) {
        console.log("API add stock notice:", apiErr);
      }
      
      const saved = localStorage.getItem('spil_category_brands');
      if (saved) {
        const map = JSON.parse(saved);
        const catKey = (addStockModal.category_name || '').toLowerCase();
        const catBrands = map[catKey] || map[addStockModal.category_id] || [];
        
        const updatedBrands = catBrands.map(b => {
          if (b.id === addStockModal.id || (b.brand === addStockModal.brand && b.model_number === addStockModal.model_number)) {
            return { ...b, stock: (parseInt(b.stock) || 0) + parseInt(stockToAdd) };
          }
          return b;
        });
        
        map[catKey] = updatedBrands;
        if (addStockModal.category_id) map[addStockModal.category_id] = updatedBrands;
        localStorage.setItem('spil_category_brands', JSON.stringify(map));
      }

      // Record Activity Log into spil_local_logs ONLY if API did not record it
      if (!apiSuccess) {
        const savedLogs = localStorage.getItem('spil_local_logs');
        const localLogs = savedLogs ? JSON.parse(savedLogs) : [];
        localLogs.unshift({
          id: 'log_' + Date.now(),
          category_id: addStockModal.category_id,
          category_name: addStockModal.category_name,
          category: { id: addStockModal.category_id, name: addStockModal.category_name },
          brand: addStockModal.brand,
          model_number: addStockModal.model_number || 'Standard',
          action_type: 'add_stock',
          quantity: parseInt(stockToAdd),
          status: 'Siap Pakai',
          location_info: `Stok Masuk Gudang (${addStockModal.category_name || 'Siap Pakai'})`,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('spil_local_logs', JSON.stringify(localLogs));
      }

      showToast(`Berhasil menambah ${stockToAdd} stok untuk ${addStockModal.brand}`, 'success');
      setAddStockModal(null);
      setStockToAdd(1);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Gagal menambah stok', 'error');
    }
  };

  const handleRestoreDamaged = async (item) => {
    try {
      // Call backend API to restore asset status to available and increment category stock
      try {
        await restoreAsset({
          asset_id: item.asset_id || item.id || 'Asset',
          category_id: item.category_id,
          brand: item.brand,
          model_number: item.model_number
        });
      } catch (err) {
        console.log('Backend restore endpoint error:', err);
      }

      const savedBrands = localStorage.getItem('spil_category_brands');
      let map = savedBrands ? JSON.parse(savedBrands) : {};
      const catKey = (item.category_name || '').toLowerCase();
      let catBrands = map[catKey] || map[item.category_id] || [];
      
      let found = false;
      const updatedBrands = catBrands.map(b => {
        if ((b.brand || '').toLowerCase() === (item.brand || '').toLowerCase() && (b.model_number || '').toLowerCase() === (item.model_number || '').toLowerCase()) {
          found = true;
          return { ...b, stock: (parseInt(b.stock) || 0) + 1 };
        }
        return b;
      });
      
      if (!found && item.brand) {
        updatedBrands.push({
          id: 'b_' + Date.now(),
          brand: item.brand,
          model_number: item.model_number || 'Standard',
          stock: 1,
          min_stock: 1,
          warranty_months: 0
        });
      }
      
      map[catKey] = updatedBrands;
      if (item.category_id) map[item.category_id] = updatedBrands;
      localStorage.setItem('spil_category_brands', JSON.stringify(map));
      
      const newDamaged = damagedInventory.filter(d => d.id !== item.id && d.asset_id !== item.asset_id);
      localStorage.setItem('spil_damaged_inventory', JSON.stringify(newDamaged));
      
      // Save history log entry for repair
      try {
        const savedLogs = localStorage.getItem('spil_local_history_logs');
        const localLogs = savedLogs ? JSON.parse(savedLogs) : [];
        localLogs.unshift({
          id: 'log_' + Date.now(),
          category_id: item.category_id,
          category: { id: item.category_id, name: item.category_name, color: item.category_color || '#3a9542' },
          asset_id: item.asset_id || item.brand || 'Item',
          brand: item.brand,
          model_number: item.model_number,
          action_type: 'repair',
          status: 'Siap Pakai (Hasil Perbaikan)',
          building_name: item.building_name || 'Gudang Utama',
          floor_name: item.floor_name || '-',
          room_name: item.room_name || '-',
          location_info: `Diperbaiki dari Gudang Rusak (${item.asset_id || item.brand}) -> Kembali ke Stok Siap Pakai`,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('spil_local_history_logs', JSON.stringify(localLogs));
      } catch (e) { console.error('Local history log save error:', e); }

      showToast('Barang berhasil diperbaiki & masuk ke Siap Pakai', 'success');
      await fetchData();
    } catch (e) {
      console.error(e);
      showToast('Gagal memulihkan barang', 'error');
    }
  };

  const handleDeleteDamagedConfirm = () => {
    if (!confirmDeleteDamaged) return;
    try {
      const item = confirmDeleteDamaged;
      const newDamaged = damagedInventory.filter(d => d.id !== item.id);
      localStorage.setItem('spil_damaged_inventory', JSON.stringify(newDamaged));

      // Save history log entry for discarded asset
      try {
        const savedLogs = localStorage.getItem('spil_local_history_logs');
        const localLogs = savedLogs ? JSON.parse(savedLogs) : [];
        localLogs.unshift({
          id: 'log_' + Date.now(),
          category_id: item.category_id,
          category: { id: item.category_id, name: item.category_name, color: item.category_color || '#3a9542' },
          asset_id: item.asset_id || item.brand || 'Item',
          brand: item.brand,
          model_number: item.model_number,
          action_type: 'remove',
          status: 'Dibuang / Off',
          building_name: item.building_name || 'Gudang Utama',
          floor_name: item.floor_name || '-',
          room_name: item.room_name || '-',
          location_info: `Dibuang permanen dari Gudang Rusak (${item.asset_id || item.brand})`,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('spil_local_history_logs', JSON.stringify(localLogs));
      } catch (e) { console.error('Local history log save error:', e); }

      showToast('Barang rusak berhasil dibuang', 'success');
      setConfirmDeleteDamaged(null);
      fetchData();
    } catch (e) {
      console.error(e);
      showToast('Gagal membuang barang', 'error');
    }
  };

  // Filtering
  const filteredGood = brandInventory.filter(b => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (b.brand || '').toLowerCase().includes(q) || 
           (b.model_number || '').toLowerCase().includes(q) ||
           (b.category_name || '').toLowerCase().includes(q);
  });

  const filteredDamaged = damagedInventory.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (d.brand || '').toLowerCase().includes(q) || 
           (d.model_number || '').toLowerCase().includes(q) ||
           (d.asset_id || '').toLowerCase().includes(q) ||
           (d.category_name || '').toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div style={{ padding: '30px', display: 'flex', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>Memuat Inventori...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header (Centered Title with Spacious Layout) */}
      <div style={{ marginBottom: '32px' }}>
        <button 
          onClick={() => navigate('/dashboard')}
          className="neu-raised-sm"
          style={{ 
            padding: '8px 16px', 
            background: 'var(--color-bg)', 
            border: 'none', 
            cursor: 'pointer', 
            color: 'var(--color-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '12px',
            fontWeight: '600',
            fontSize: '0.875rem',
            marginBottom: '16px'
          }}
        >
          <ArrowLeft size={18} />
          <span>Kembali ke Denah</span>
        </button>

        <div style={{ textAlign: 'center', margin: '0 auto', maxWidth: '650px' }}>
          <h1 style={{ fontSize: '2.1rem', color: '#15803d', margin: '0 0 8px 0', fontWeight: '900', letterSpacing: '-0.6px', lineHeight: '1.2' }}>
            Manajemen Inventori
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: '1rem', lineHeight: '1.5', fontWeight: '600' }}>
            Kelola stok barang siap pakai dan barang rusak secara terpusat.
          </p>
        </div>
      </div>

      {/* Action Row: Tabs (Left) & Search + Tambah Kategori (Right, Sejajar) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            onClick={() => { setActiveTab('good'); setSelectedCategoryView(null); }}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: activeTab === 'good' ? 'none' : '1px solid #cbd5e1',
              background: activeTab === 'good' ? '#15803d' : 'var(--color-bg)',
              color: activeTab === 'good' ? '#ffffff' : '#475569',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'good' ? '0 4px 14px rgba(21, 128, 61, 0.35)' : '0 2px 4px rgba(0,0,0,0.03)'
            }}
          >
            <Package size={20} />
            <span>Stok Siap Pakai ({categories.length})</span>
          </button>

          <button 
            onClick={() => { setActiveTab('damaged'); setSelectedCategoryView(null); }}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: activeTab === 'damaged' ? 'none' : '1px solid #cbd5e1',
              background: activeTab === 'damaged' ? '#dc2626' : 'var(--color-bg)',
              color: activeTab === 'damaged' ? '#ffffff' : '#475569',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'damaged' ? '0 4px 14px rgba(220, 38, 38, 0.35)' : '0 2px 4px rgba(0,0,0,0.03)'
            }}
          >
            <PackageX size={20} />
            <span>Barang Rusak ({damagedInventory.length})</span>
          </button>
        </div>

        {/* Right Side: Search Input + Tambah Kategori Button (Sejajar & Rata Tengah Vertikal) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: '12px', background: '#ffffff', border: '1.5px solid #cbd5e1', width: '280px', height: '44px', boxSizing: 'border-box', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
            <Search size={18} color="#64748b" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input 
              type="text"
              placeholder="Cari merk, tipe, atau ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '0.95rem', color: '#0f172a', fontWeight: '600' }}
            />
          </div>

          {(activeTab === 'good' && !selectedCategoryView) && (
            <button
              onClick={handleOpenAddCategoryModal}
              className="neu-action-btn"
              style={{
                height: '44px',
                padding: '0 22px',
                borderRadius: '12px',
                border: 'none',
                background: '#15803d',
                color: 'white',
                fontWeight: '800',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(21, 128, 61, 0.3)',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={18} />
              <span>Tambah Kategori</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="neu-inset" style={{ padding: '24px', borderRadius: '18px', background: 'rgba(255,255,255,0.6)', border: '1px solid #e2e8f0', minHeight: '400px' }}>
        
        {(activeTab === 'category' || activeTab === 'good') && (
          <div>
            {!selectedCategoryView ? (
              // CATEGORY GRID VIEW (Bold, Crisp & Prominent!)
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '20px' }}>
                {categories.map(cat => {
                  const catBrands = brandInventory.filter(b => String(b.category_id) === String(cat.id) || (b.category_name || '').toLowerCase() === (cat.name || '').toLowerCase());
                  const totalStock = catBrands.reduce((acc, b) => acc + (parseInt(b.stock) || 0), 0);
                  
                  if (searchQuery && !cat.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                    const brandMatch = catBrands.some(b => 
                      (b.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                      (b.model_number || '').toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    if (!brandMatch) return null;
                  }

                  return (
                    <div 
                      key={cat.id} 
                      onClick={() => setSelectedCategoryView(cat)}
                      style={{ 
                        padding: '20px 22px', borderRadius: '16px', background: '#ffffff',
                        cursor: 'pointer', transition: 'all 0.2s ease', border: '1.5px solid #e2e8f0',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.border = '1.5px solid #15803d';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(21,128,61,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.border = '1.5px solid #e2e8f0';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.05)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, overflow: 'hidden' }}>
                        <div style={{ 
                          width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                          background: `${cat.color || '#3b82f6'}22`, 
                          color: cat.color || '#3b82f6', 
                          border: `2px solid ${cat.color || '#3b82f6'}40`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '900', fontSize: '1.5rem',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                        }}>
                          {(cat.name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {cat.name}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '8px' }}>
                              {catBrands.length} Varian
                            </span>
                            <span style={{ 
                              padding: '4px 10px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '800',
                              background: totalStock > 0 ? '#15803d' : '#dc2626',
                              color: '#ffffff',
                              boxShadow: totalStock > 0 ? '0 2px 8px rgba(21,128,61,0.25)' : '0 2px 8px rgba(220,38,38,0.25)'
                            }}>
                              {totalStock} Total Stok
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action edit/delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={(e) => handleOpenEditCategoryModal(cat, e)}
                          style={{ 
                            padding: '7px 9px', color: '#b45309', background: 'rgba(245, 158, 11, 0.12)', 
                            border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' 
                          }}
                          title="Edit Kategori"
                        >
                          <Edit2 size={16} color="#b45309" />
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation();
                            const isUsed = activeEquipments.some(eq => 
                              String(eq.category_id || eq.category?.id) === String(cat.id) || 
                              (eq.category_name || '').toLowerCase() === (cat.name || '').toLowerCase()
                            );
                            if (isUsed) {
                              setCategoryBlockedNotice(cat);
                            } else {
                              setConfirmDeleteCategory(cat);
                            }
                          }}
                          style={{ 
                            padding: '7px 9px', color: '#dc2626', background: 'rgba(239, 68, 68, 0.12)', 
                            border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' 
                          }}
                          title="Hapus Kategori"
                        >
                          <Trash2 size={16} color="#dc2626" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !selectedBrandDetail ? (
              // BRANDS WITHIN CATEGORY VIEW
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      onClick={() => setSelectedCategoryView(null)}
                      className="neu-action-btn"
                      style={{ padding: '6px', borderRadius: '8px', background: 'var(--color-bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <ArrowLeft size={20} color="var(--color-text-secondary)" />
                    </button>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: selectedCategoryView.color || 'var(--color-primary)' }} />
                      Stok Kategori: {selectedCategoryView.name}
                    </h3>
                  </div>

                  <button
                    onClick={handleOpenAddBrandModal}
                    className="neu-action-btn"
                    style={{
                      padding: '8px 16px',
                      borderRadius: '10px',
                      background: 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 10px rgba(58, 149, 66, 0.2)'
                    }}
                  >
                    <Plus size={16} />
                    <span>Tambah Barang / Merk Baru</span>
                  </button>
                </div>

                {filteredGood.filter(b => String(b.category_id) === String(selectedCategoryView.id) || (b.category_name || '').toLowerCase() === (selectedCategoryView.name || '').toLowerCase()).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
                    <Package size={48} opacity={0.3} style={{ marginBottom: '12px' }} />
                    <p style={{ margin: '0 0 16px' }}>Tidak ada barang/varian untuk kategori ini.</p>
                    <button
                      onClick={handleOpenAddBrandModal}
                      className="neu-action-btn"
                      style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        background: 'var(--color-primary)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Plus size={18} />
                      <span>Tambah Barang Pertama</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {filteredGood.filter(b => String(b.category_id) === String(selectedCategoryView.id) || (b.category_name || '').toLowerCase() === (selectedCategoryView.name || '').toLowerCase()).map(item => {
                      const isLowStock = item.stock <= (item.min_stock || 0);
                      return (
                        <div 
                          key={item.id} 
                          onClick={() => setSelectedBrandDetail(item)}
                          style={{ 
                            padding: '18px 20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px', 
                            background: '#ffffff', cursor: 'pointer', border: '1.5px solid #e2e8f0', 
                            boxShadow: '0 4px 16px rgba(0,0,0,0.05)', transition: 'all 0.2s ease', position: 'relative' 
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.border = '1.5px solid #15803d';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(21,128,61,0.15)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.border = '1.5px solid #e2e8f0';
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.05)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ 
                                width: '46px', height: '46px', borderRadius: '12px', 
                                background: `${item.category_color}22`, 
                                color: item.category_color, 
                                border: `2px solid ${item.category_color}40`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: '900', fontSize: '1.3rem',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                              }}>
                                {(item.category_name || 'B').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: item.category_color, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                                  {item.category_name}
                                </span>
                                <h4 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: '900', color: '#0f172a' }}>
                                  {item.brand}
                                </h4>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ 
                                padding: '6px 14px', 
                                borderRadius: '10px', 
                                background: isLowStock ? '#dc2626' : '#15803d',
                                color: '#ffffff',
                                boxShadow: isLowStock ? '0 4px 12px rgba(220,38,38,0.25)' : '0 4px 12px rgba(21,128,61,0.25)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center'
                              }}>
                                <span style={{ fontSize: '0.68rem', fontWeight: '900', letterSpacing: '0.5px' }}>STOK</span>
                                <span style={{ fontSize: '1.3rem', fontWeight: '900' }}>{item.stock}</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteBrand(item, e)}
                                style={{ 
                                  padding: '8px 10px', 
                                  color: '#dc2626', 
                                  background: 'rgba(239, 68, 68, 0.12)', 
                                  borderRadius: '8px', 
                                  border: '1px solid rgba(239, 68, 68, 0.3)', 
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  zIndex: 5
                                }}
                                title="Hapus / Buang Stok Varian Barang Ini"
                              >
                                <Trash2 size={16} color="#dc2626" />
                              </button>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '12px', fontSize: '0.88rem', color: '#334155', padding: '10px 0', borderTop: '1.5px dashed #e2e8f0', borderBottom: '1.5px dashed #e2e8f0' }}>
                            <div style={{ flex: 1 }}>
                              <strong style={{ color: '#0f172a' }}>Tipe:</strong> {item.model_number || '-'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <strong style={{ color: '#0f172a' }}>Garansi:</strong> {item.warranty_months ? `${item.warranty_months} Bln` : '-'}
                            </div>
                          </div>

                          <button 
                            onClick={(e) => { e.stopPropagation(); setAddStockModal(item); }}
                            style={{ 
                              width: '100%', padding: '12px', borderRadius: '10px', 
                              background: '#15803d', color: 'white', border: 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                              fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer',
                              boxShadow: '0 4px 12px rgba(21, 128, 61, 0.25)'
                            }}
                          >
                            <Plus size={18} /> Tambah Stok
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              // BRAND DETAIL VIEW (INDIVIDUAL ITEMS)
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      onClick={() => setSelectedBrandDetail(null)}
                      className="neu-action-btn"
                      style={{ padding: '6px', borderRadius: '8px', background: 'var(--color-bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <ArrowLeft size={20} color="var(--color-text-secondary)" />
                    </button>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-primary)' }}>
                      Detail {selectedBrandDetail.brand} {selectedBrandDetail.model_number ? `(${selectedBrandDetail.model_number})` : ''}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setAddStockModal(selectedBrandDetail)}
                    className="neu-action-btn"
                    style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Plus size={18} /> Tambah Stok
                  </button>
                </div>
                
                {(() => {
                  const categoryAllBrands = filteredGood.filter(b => 
                    String(b.category_id) === String(selectedBrandDetail.category_id) || 
                    (b.category_name || '').toLowerCase() === (selectedBrandDetail.category_name || '').toLowerCase()
                  );

                  let startIndex = 0;
                  for (const b of categoryAllBrands) {
                    if ((b.brand || '').toLowerCase() === (selectedBrandDetail.brand || '').toLowerCase() && 
                        (b.model_number || '').toLowerCase() === (selectedBrandDetail.model_number || '').toLowerCase()) {
                      break;
                    }
                    const precDipasang = activeEquipments.filter(e => (e.brand || '').toLowerCase() === (b.brand || '').toLowerCase() && (e.model_number || '').toLowerCase() === (b.model_number || '').toLowerCase()).length;
                    const precRusak = damagedInventory.filter(d => (d.brand || '').toLowerCase() === (b.brand || '').toLowerCase() && (d.model_number || '').toLowerCase() === (b.model_number || '').toLowerCase()).length;
                    const precSiap = parseInt(b.stock) || 0;
                    startIndex += (precDipasang + precRusak + precSiap);
                  }

                  const dipasang = activeEquipments.filter(e => (e.brand || '').toLowerCase() === (selectedBrandDetail.brand || '').toLowerCase() && (e.model_number || '').toLowerCase() === (selectedBrandDetail.model_number || '').toLowerCase());
                  const rusak = damagedInventory.filter(d => (d.brand || '').toLowerCase() === (selectedBrandDetail.brand || '').toLowerCase() && (d.model_number || '').toLowerCase() === (selectedBrandDetail.model_number || '').toLowerCase());
                  
                  const siapPakaiAssets = availableAssets.filter(a => (a.brand || '').toLowerCase() === (selectedBrandDetail.brand || '').toLowerCase() && (a.model_number || '').toLowerCase() === (selectedBrandDetail.model_number || '').toLowerCase());
                  const siapPakaiCount = parseInt(selectedBrandDetail.stock) || 0;
                  
                  let siapPakaiList = [];
                  if (siapPakaiAssets.length > 0) {
                      siapPakaiList = siapPakaiAssets.map((a, i) => ({
                        id: a.id,
                        asset_id: a.asset_id || `${selectedBrandDetail.category_name || 'Asset'} - ${startIndex + dipasang.length + rusak.length + i + 1}`,
                        status: 'Siap Pakai',
                        date: a.created_at,
                        is_ready: false,
                        brand: a.brand,
                        model_number: a.model_number
                      }));
                  } else if (siapPakaiCount > 0) {
                      siapPakaiList = Array.from({ length: siapPakaiCount }).map((_, i) => ({
                      id: `${selectedBrandDetail.category_name || 'Asset'} - ${startIndex + dipasang.length + rusak.length + i + 1}`,
                      asset_id: `${selectedBrandDetail.category_name || 'Asset'} - ${startIndex + dipasang.length + rusak.length + i + 1}`,
                      status: 'Siap Pakai',
                      date: selectedBrandDetail.created_at || new Date().toISOString(),
                      is_ready: false,
                      brand: selectedBrandDetail.brand,
                      model_number: selectedBrandDetail.model_number
                    }));
                  }
                  
                  const allItems = [
                    ...dipasang.map((d, idx) => ({ 
                      ...d, 
                      asset_id: d.asset_id || d.name || `${selectedBrandDetail.category_name || 'Asset'} - ${startIndex + idx + 1}`,
                      status: 'Dipasang (Di Lantai)' 
                    })),
                    ...rusak.map((r, idx) => ({ 
                      ...r, 
                      asset_id: r.asset_id || r.name || `${selectedBrandDetail.category_name || 'Asset'} - ${startIndex + dipasang.length + idx + 1}`,
                      status: 'Gudang Rusak' 
                    })),
                    ...siapPakaiList
                  ];
                  
                  if (allItems.length === 0) return <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px' }}>Belum ada data barang untuk varian ini.</p>;
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {allItems.slice(0, visibleCount).map((it, idx) => (
                        <div 
                          key={it.id || idx} 
                          className="neu-raised-sm"
                          onClick={() => setItemHistoryModal(it)}
                          style={{ 
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                            padding: '14px', background: 'var(--color-bg)', borderRadius: '10px', 
                            border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.border = '1px solid var(--color-primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.border = '1px solid transparent'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: it.status === 'Siap Pakai' ? 'rgba(34, 197, 94, 0.1)' : (it.status.includes('Rusak') ? 'rgba(249, 115, 22, 0.1)' : (it.status === 'Dibuang' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)')),
                              color: it.status === 'Siap Pakai' ? '#15803d' : (it.status.includes('Rusak') ? '#c2410c' : (it.status === 'Dibuang' ? '#b91c1c' : '#1d4ed8'))
                            }}>
                              {it.status.includes('Rusak') ? <PackageX size={18} /> : (it.status === 'Siap Pakai' ? <Package size={18} /> : (it.status === 'Dibuang' ? <Trash2 size={18} /> : <Check size={18} />))}
                            </div>
                            <div>
                              <strong style={{ display: 'block', color: 'var(--color-text-primary)' }}>
                                {it.name || it.asset_id || it.id}
                              </strong>
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>
                                Ditambahkan/Diubah: {new Date(it.placed_at || it.unassigned_at || it.date || it.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              {it.floor && (
                                <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                                  <MapPin size={12} /> {it.floor.building?.name || 'Gedung'} - {it.floor.name || 'Lantai'}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              padding: '6px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                              background: it.status === 'Siap Pakai' ? 'rgba(34, 197, 94, 0.1)' : (it.status.includes('Rusak') ? 'rgba(249, 115, 22, 0.1)' : (it.status === 'Dibuang' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)')),
                              color: it.status === 'Siap Pakai' ? '#15803d' : (it.status.includes('Rusak') ? '#c2410c' : (it.status === 'Dibuang' ? '#b91c1c' : '#1d4ed8'))
                            }}>
                              {it.status}
                            </div>
                            <History size={18} color="var(--color-text-muted)" />
                          </div>
                        </div>
                      ))}
                      
                      {visibleCount < allItems.length && (
                        <button 
                          onClick={() => setVisibleCount(prev => prev + 50)}
                          className="neu-action-btn"
                          style={{ padding: '12px', borderRadius: '10px', background: 'var(--color-bg)', border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginTop: '10px' }}
                        >
                          Tampilkan Lebih Banyak ({allItems.length - visibleCount} tersisa)
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {activeTab === 'damaged' && (
          <div>
            {filteredDamaged.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
                <PackageX size={48} opacity={0.3} style={{ marginBottom: '12px' }} />
                <p>Tidak ada barang rusak di inventori saat ini.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {filteredDamaged.map(item => (
                  <div key={item.id} className="neu-raised-sm" style={{ padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-bg)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '10px', 
                          background: `rgba(239, 68, 68, 0.1)`, 
                          color: '#b91c1c', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'bold'
                        }}>
                          <PackageX size={20} />
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {item.asset_id}
                          </span>
                          <h4 style={{ margin: '2px 0 0', fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                            {item.brand} {item.model_number ? `(${item.model_number})` : ''}
                          </h4>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', padding: '10px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>Kategori:</strong> {item.category_name}</div>
                      <div>
                        <strong>Waktu Pemasangan:</strong> {item.installed_at || item.created_at ? new Date(item.installed_at || item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tidak tercatat'}
                      </div>
                      <div>
                        <strong>Waktu Rusak:</strong> {item.unassigned_at ? new Date(item.unassigned_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </div>
                      {(() => {
                        const installStr = item.installed_at || item.created_at;
                        const damageStr = item.unassigned_at;
                        if (!installStr || !damageStr) return null;
                        
                        const tInstall = new Date(installStr).getTime();
                        const tDamage = new Date(damageStr).getTime();
                        if (isNaN(tInstall) || isNaN(tDamage) || tDamage < tInstall) return null;
                        
                        const diffDays = Math.floor((tDamage - tInstall) / (1000 * 60 * 60 * 24));
                        let usageStr = '';
                        if (diffDays === 0) {
                          usageStr = 'Hari yang sama (< 1 hari)';
                        } else if (diffDays < 30) {
                          usageStr = `${diffDays} hari`;
                        } else {
                          const months = Math.floor(diffDays / 30);
                          const remDays = diffDays % 30;
                          usageStr = `${months} bulan ${remDays > 0 ? `${remDays} hari` : ''} (${diffDays} hari)`;
                        }

                        return (
                          <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed rgba(0,0,0,0.1)', color: '#d97706', fontWeight: '700', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>Waktu Pemakaian: {usageStr}</span>
                          </div>
                        );
                      })()}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button 
                        onClick={() => handleRestoreDamaged(item)}
                        className="neu-action-btn"
                        style={{ 
                          flex: 1, padding: '8px', borderRadius: '8px', 
                          background: 'rgba(34, 197, 94, 0.1)', color: '#15803d', border: '1px solid rgba(34, 197, 94, 0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem'
                        }}
                      >
                        <Wrench size={14} /> Perbaiki (Stok)
                      </button>
                      <button 
                        onClick={() => setConfirmDeleteDamaged(item)}
                        className="neu-action-btn"
                        style={{ 
                          flex: 1, padding: '8px', borderRadius: '8px', 
                          background: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c', border: '1px solid rgba(239, 68, 68, 0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem'
                        }}
                      >
                        <Trash2 size={14} /> Buang
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL POPUP TAMBAH BARANG / MERK BARU */}
      {showAddBrandModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="neu-raised" style={{ background: 'var(--color-bg)', padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '460px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.2rem' }}>
                Tambah Barang Baru ({selectedCategoryView?.name})
              </h3>
              <button onClick={() => setShowAddBrandModal(false)} className="neu-action-btn" style={{ padding: '6px', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={20} color="var(--color-text-muted)" />
              </button>
            </div>

            <form onSubmit={handleAddBrandSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)' }}>
                  Merk Barang *
                </label>
                <input 
                  type="text" 
                  placeholder="Contoh: LG, Panasonic, Philips, Daikin"
                  value={brandForm.brand}
                  onChange={(e) => setBrandForm({ ...brandForm, brand: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.95rem', outline: 'none' }}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)' }}>
                  Tipe / Model Number
                </label>
                <input 
                  type="text" 
                  placeholder="Contoh: Inverter 1PK, LED 14W, Smart TV 43"
                  value={brandForm.model_number}
                  onChange={(e) => setBrandForm({ ...brandForm, model_number: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)' }}>
                    Stok Awal
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    value={brandForm.stock}
                    onChange={(e) => setBrandForm({ ...brandForm, stock: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.95rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)' }}>
                    Minimum Stok (Peringatan)
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    value={brandForm.min_stock}
                    onChange={(e) => setBrandForm({ ...brandForm, min_stock: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.95rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)' }}>
                  Masa Garansi (Bulan)
                </label>
                <input 
                  type="number" 
                  min="0"
                  placeholder="Contoh: 12, 24, 36 (0 jika tanpa garansi)"
                  value={brandForm.warranty_months}
                  onChange={(e) => setBrandForm({ ...brandForm, warranty_months: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddBrandModal(false)} className="neu-action-btn" style={{ padding: '10px 18px', borderRadius: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
                  Batal
                </button>
                <button type="submit" className="neu-action-btn" style={{ padding: '10px 22px', borderRadius: '10px', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '700' }}>
                  Simpan Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL POPUP TAMBAH / EDIT KATEGORI */}
      {showAddCategoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="neu-raised" style={{ background: 'var(--color-bg)', padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.25rem' }}>
                {editingCategoryModal ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </h3>
              <button onClick={() => setShowAddCategoryModal(false)} className="neu-action-btn" style={{ padding: '6px', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={20} color="var(--color-text-muted)" />
              </button>
            </div>

            <form onSubmit={handleModalCategorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)' }}>
                  Nama Kategori *
                </label>
                <input 
                  type="text" 
                  placeholder="Contoh: Lampu, AC, Kipas"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.95rem', outline: 'none' }}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)' }}>
                  Warna Penanda
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input 
                    type="color" 
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    style={{ width: '44px', height: '44px', padding: 0, border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: '600' }}>{catColor}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  <input 
                    type="checkbox" 
                    checked={catHasId}
                    onChange={(e) => setCatHasId(e.target.checked)}
                    style={{ marginTop: '3px', width: '16px', height: '16px' }}
                  />
                  <span>
                    Centang jika barang ini adalah <strong>Aset ber-ID</strong> (misal: AC, CCTV). Biarkan kosong jika barang habis pakai (misal: Lampu).
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddCategoryModal(false)} className="neu-action-btn" style={{ padding: '10px 18px', borderRadius: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
                  Batal
                </button>
                <button type="submit" className="neu-action-btn" style={{ padding: '10px 22px', borderRadius: '10px', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '700' }}>
                  {editingCategoryModal ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Category Modal */}
      <ConfirmModal 
        isOpen={confirmDeleteCategory !== null}
        onClose={() => setConfirmDeleteCategory(null)}
        onConfirm={handleDeleteCategoryConfirm}
        title="Hapus Kategori"
        message={`Apakah Anda yakin ingin menghapus kategori "${confirmDeleteCategory?.name}"? Data terkait kategori ini akan disesuaikan.`}
      />

      {/* Add Stock Modal */}
      {addStockModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="neu-raised" style={{ background: 'var(--color-bg)', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--color-primary)' }}>Tambah Stok Baru</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              Menambah stok untuk <strong>{addStockModal.brand} ({addStockModal.model_number || 'Standard'})</strong>
            </p>
            
            <form onSubmit={handleAddStockSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)' }}>
                  Jumlah Stok Masuk
                </label>
                <input 
                  type="number" 
                  min="1"
                  value={stockToAdd}
                  onChange={(e) => setStockToAdd(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '1rem', outline: 'none' }}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setAddStockModal(null)} className="neu-action-btn" style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: 'none', cursor: 'pointer' }}>Batal</button>
                <button type="submit" className="neu-action-btn" style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Simpan Stok</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Damaged */}
      <ConfirmModal 
        isOpen={confirmDeleteDamaged !== null}
        onClose={() => setConfirmDeleteDamaged(null)}
        onConfirm={handleDeleteDamagedConfirm}
        title="Buang Barang Rusak"
        message={`Apakah Anda yakin ingin membuang secara permanen barang rusak ini (${confirmDeleteDamaged?.asset_id})? Data tidak dapat dikembalikan.`}
      />

      {/* Confirm Delete Brand / Variant */}
      <ConfirmModal 
        isOpen={confirmDeleteBrand !== null}
        onClose={() => setConfirmDeleteBrand(null)}
        onConfirm={confirmDeleteBrandAction}
        title="Konfirmasi Buang / Hapus Stok Barang"
        message={`Apakah Anda yakin ingin menghapus varian merk ${confirmDeleteBrand?.brand} ${confirmDeleteBrand?.model_number ? '(' + confirmDeleteBrand.model_number + ')' : ''} (Total stok: ${confirmDeleteBrand?.stock || 0} unit)? Stok ini akan dibuang dan dicatat sebagai 'Dibuang / Dihapus' di Riwayat Audit Log dan Daftar Pemakaian.`}
      />

      {/* Item History Modal */}
      {itemHistoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="neu-raised" style={{ background: 'var(--color-bg)', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={20} /> Histori Perjalanan Barang
                </h3>
                <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                  ID: {itemHistoryModal.is_ready ? 'Belum Ditetapkan (Siap Pakai)' : (itemHistoryModal.asset_id || itemHistoryModal.name || itemHistoryModal.id)}
                </p>
              </div>
              <button onClick={() => setItemHistoryModal(null)} className="neu-action-btn" style={{ padding: '6px', borderRadius: '50%', background: 'var(--color-bg)', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={20} color="var(--color-text-muted)" />
              </button>
            </div>
            
            <div style={{ padding: '10px 0' }}>
              {(() => {
                let specificLogs = [];
                const actualId = itemHistoryModal.asset_id || itemHistoryModal.name || itemHistoryModal.id;
                
                if (actualId && !actualId.toString().startsWith('sp_')) {
                  specificLogs = inventoryLogs.filter(l => l.asset_id === actualId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                }

                const timeline = [];
                
                specificLogs.forEach(log => {
                   let icon = <Check size={14} color="white" />;
                   let color = '#3b82f6';
                   if (log.action_type === 'assign') { icon = <MapPin size={14} color="white" />; color = '#10b981'; }
                   if (log.action_type === 'unassign' || log.action_type === 'remove' || log.action_type === 'damage') { icon = <Trash2 size={14} color="white" />; color = '#ef4444'; }
                   if (log.action_type === 'repair' || log.action_type === 'move') { icon = <Wrench size={14} color="white" />; color = '#f59e0b'; }
                   
                   timeline.push({
                     date: new Date(log.created_at),
                     title: log.location_info || (log.action_type.charAt(0).toUpperCase() + log.action_type.slice(1)),
                     desc: `Oleh: Sistem/User`,
                     color,
                     icon
                   });
                });
                
                if (itemHistoryModal.status.includes('Dipasang') && specificLogs.length === 0) {
                   timeline.push({
                     date: new Date(itemHistoryModal.placed_at || itemHistoryModal.created_at || new Date()),
                     title: `Dipasang di ${itemHistoryModal.floor?.building?.name || ''} ${itemHistoryModal.floor?.name || ''}`,
                     desc: `Status: Dipasang (Di Lantai)`,
                     color: '#10b981',
                     icon: <MapPin size={14} color="white" />
                   });
                }
                
                const birthDate = itemHistoryModal.date || itemHistoryModal.created_at || (specificLogs.length ? specificLogs[specificLogs.length-1].created_at : new Date());
                timeline.push({
                   date: new Date(birthDate),
                   title: 'Ditambahkan ke Stok (Siap Pakai)',
                   desc: `Merk: ${itemHistoryModal.brand} ${itemHistoryModal.model_number ? '('+itemHistoryModal.model_number+')' : ''}`,
                   color: '#8b5cf6',
                   icon: <Package size={14} color="white" />
                });
                
                timeline.sort((a, b) => b.date - a.date);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {timeline.map((ev, i) => (
                      <div key={i} style={{ display: 'flex', gap: '16px', position: 'relative', paddingBottom: i !== timeline.length - 1 ? '24px' : '0' }}>
                        {i !== timeline.length - 1 && (
                          <div style={{ position: 'absolute', left: '15px', top: '30px', bottom: '0', width: '2px', background: 'rgba(0,0,0,0.1)' }} />
                        )}
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: ev.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                          {ev.icon}
                        </div>
                        <div style={{ background: 'var(--color-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', flex: 1, marginTop: '-4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>
                            {ev.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
                          </span>
                          <h4 style={{ margin: '4px 0', fontSize: '1rem', color: 'var(--color-text-primary)' }}>{ev.title}</h4>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{ev.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
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
    </div>
  );
};

export default InventoryPage;
