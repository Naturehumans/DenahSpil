import React, { useState, useEffect } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/categories';
import { getAllEquipments } from '../api/equipments';
import { getInventoryLogs, addStockToInventory, getAssets, restoreAsset, deleteAsset, deleteAssetsByBrand, deleteOneAssetByBrand } from '../api/inventory';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Search, Package, PackageX, Wrench, Trash2, ArrowLeft, Plus, Minus, Check, X, MapPin, History, Tag, Edit2, AlertTriangle } from 'lucide-react';
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
    warranty_months: '0',
    purchase_date: '',
    ac_type: 'in_out'
  });

  // Stock & Damaged modals
  const [addStockModal, setAddStockModal] = useState(null);
  const [stockToAdd, setStockToAdd] = useState(1);
  const [acType, setAcType] = useState('in_out');
  const [confirmDeleteDamaged, setConfirmDeleteDamaged] = useState(null);
  const [confirmDeleteBrand, setConfirmDeleteBrand] = useState(null);
  const [itemHistoryModal, setItemHistoryModal] = useState(null);

  const { showToast } = useToast();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  useEffect(() => {
    // Non-admins can now view the inventory page (read-only)
  }, [isAdmin]);

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
    try {
      await deleteAssetsByBrand({
        category_id: item.category_id,
        brand: item.brand === 'Tanpa Merk' ? undefined : item.brand,
        model_number: item.model_number === 'Standard' ? undefined : item.model_number,
      });

      showToast(`Merk ${item.brand} berhasil dibuang & dicatat dalam riwayat log`, 'success');
      setConfirmDeleteBrand(null);
      await fetchData(false);
    } catch (err) {
      console.error('Delete brand error:', err.response?.data || err);
      showToast('Gagal membuang stok barang: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };
  
  
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setVisibleCount(50);
  }, [selectedBrandDetail]);

  const getDaysToExpiration = (expiredDateStr) => {
    if (!expiredDateStr) return null;
    const exp = new Date(expiredDateStr);
    const now = new Date();
    exp.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    const diffTime = exp.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);

      const [cats, assets, damagedAssets, eqs, logs] = await Promise.all([
        getCategories().catch(() => []),
        getAssets('available').catch(() => []),
        getAssets('damaged').catch(() => []),
        getAllEquipments().catch(() => []),
        getInventoryLogs().catch(() => [])
      ]);

      setCategories(cats);
      
      // Load Available Assets from Backend
      setAvailableAssets(assets || []);
      
      // Group available assets into brandInventory format.
      // SOURCE OF TRUTH: Only backend AssetInventory records create brand cards.
      // localStorage is only used to enrich metadata (warranty, min_stock).
      let map = {};
      if (assets && Array.isArray(assets)) {
        assets.forEach(asset => {
          const baseModel = (asset.model_number || 'Standard');
          const key = `${asset.category_id}_${(asset.brand || 'Tanpa Merk').toLowerCase()}_${baseModel.toLowerCase()}`;
          if (!map[key]) {
            map[key] = {
              id: `b_${asset.category_id}_${asset.brand}_${baseModel}`,
              category_id: asset.category_id,
              category_name: asset.category?.name || 'Umum',
              category_color: asset.category?.color || '#3b82f6',
              brand: asset.brand || 'Tanpa Merk',
              model_number: baseModel,
              original_model: baseModel,
              ac_type: 'in_out',
              stock: 0,
              asset_count: 0,
              min_stock: 1,
              warranty_months: 0,
              purchase_date: null,
              expired_date: null,
              assets: []
            };
          }
          const isAC = (asset.category?.name || '').toUpperCase().includes('AC');
          if (isAC) {
             if (!map[key].ac_base_ids) map[key].ac_base_ids = new Set();
             let baseId = asset.asset_id || '';
             if (baseId.endsWith('-IN')) baseId = baseId.replace('-IN', '');
             if (baseId.endsWith('-OUT')) baseId = baseId.replace('-OUT', '');
             map[key].ac_base_ids.add(baseId);
             map[key].asset_count = map[key].ac_base_ids.size;
          } else {
             map[key].asset_count += 1;
          }
          map[key].assets.push(asset);
        });
      }

      // Set stock = asset_count for all items (backend is the source of truth for quantity)
      Object.keys(map).forEach(key => {
        map[key].stock = map[key].asset_count;
      });

      // Enrich with metadata from localStorage (warranty, min_stock only — do NOT add new cards)
      const localBrands = localStorage.getItem('spil_category_brands');
      if (localBrands) {
        try {
          const parsedBrands = JSON.parse(localBrands);
          Object.keys(parsedBrands).forEach(catNameKey => {
            parsedBrands[catNameKey].forEach(b => {
              const cat = cats.find(c => c.id === b.category_id || (c.name || '').toLowerCase() === catNameKey);
              const catId = b.category_id || (cat ? cat.id : catNameKey);
              const baseModel = b.model_number || 'Standard';
              const key = `${catId}_${(b.brand || 'Tanpa Merk').toLowerCase()}_${baseModel.toLowerCase()}`;
              // Only enrich existing backend-sourced entries — do NOT create new ones
              if (map[key]) {
                map[key].min_stock = Math.max(map[key].min_stock, parseInt(b.min_stock) || 0);
                map[key].warranty_months = Math.max(map[key].warranty_months, parseInt(b.warranty_months) || 0);
              }
            });
          });
        } catch (err) {
          console.error("Failed to parse spil_category_brands", err);
        }
      }

      const sortedBrandInventory = Object.values(map).sort((a, b) => {
        const catCmp = (a.category_name || '').localeCompare(b.category_name || '');
        if (catCmp !== 0) return catCmp;
        const brandCmp = (a.brand || '').localeCompare(b.brand || '');
        if (brandCmp !== 0) return brandCmp;
        return (a.model_number || '').localeCompare(b.model_number || '');
      });
      
      setBrandInventory(sortedBrandInventory);

      // Load Damaged Inventory from Backend
      let localDamaged = [];
      if (damagedAssets && Array.isArray(damagedAssets)) {
        localDamaged = damagedAssets.map(a => ({
          id: a.id,
          asset_id: a.asset_id || a.name || `AST-${a.id}`,
          brand: a.brand || 'Tanpa Merk',
          model_number: a.model_number || 'Standard',
          category_id: a.category_id,
          category_name: a.category?.name || 'Umum',
          category_color: a.category?.color || '#3b82f6',
          unassigned_at: a.updated_at || a.created_at || new Date().toISOString(),
          is_local: false
        }));
      }

      // Merge local storage spil_damaged_inventory
      const localDamagedStr = localStorage.getItem('spil_damaged_inventory');
      if (localDamagedStr) {
        try {
          const parsedDamaged = JSON.parse(localDamagedStr);
          parsedDamaged.forEach(d => {
            const cat = cats.find(c => c.id === d.category_id || (c.name || '').toLowerCase() === (d.category_name || '').toLowerCase());
            localDamaged.push({
              id: d.id || `local_dmg_${Date.now()}_${Math.random()}`,
              asset_id: d.asset_id || d.name || `Barang-${Math.floor(Math.random()*1000)}`,
              brand: d.brand || 'Tanpa Merk',
              model_number: d.model_number || 'Standard',
              category_id: d.category_id || (cat ? cat.id : null),
              category_name: d.category_name || cat?.name || 'Umum',
              category_color: cat?.color || '#f59e0b',
              unassigned_at: d.unassigned_at || new Date().toISOString(),
              is_local: true,
              original_local_data: d
            });
          });
        } catch (err) {
          console.error("Failed to parse spil_damaged_inventory", err);
        }
      }

      setDamagedInventory(localDamaged);
      
      // Load Active Equipments
      setActiveEquipments(eqs || []);
      
      // Load History Logs
      setInventoryLogs(logs || []);
      
    } catch (e) {
      console.error(e);
      showToast('Gagal memuat data inventori', 'error');
    } finally {
      if (showLoading) setLoading(false);
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
      fetchData(false);
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
      fetchData(false);
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
      warranty_months: 0,
      purchase_date: '',
      expired_date: '',
      ac_type: 'in_out'
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
      const stock = parseInt(brandForm.stock) || 1;
      await addStockToInventory({
        category_id: selectedCategoryView.id,
        brand: brandForm.brand.trim(),
        model_number: brandForm.model_number.trim() || 'Standard',
        quantity: stock,
        ac_type: (selectedCategoryView.name || '').toUpperCase().includes('AC') ? brandForm.ac_type : undefined
      });

      showToast(`Berhasil menambah barang ${brandForm.brand.trim()}!`, 'success');
      setShowAddBrandModal(false);
      fetchData(false);
    } catch (err) {
      console.error(err);
      showToast('Gagal menambahkan barang', 'error');
    }
  };



  const handleQuickAddStock = async (item, e) => {
    e.stopPropagation();
    
    const isAC = (item.category_name || '').toUpperCase().includes('AC');
    if (isAC) {
      setAddStockModal(item);
      setStockToAdd(1);
      setAcType(item.ac_type || 'in_out');
      return;
    }

    try {
      await addStockToInventory({
        category_id: item.category_id,
        brand: item.brand,
        model_number: item.original_model || item.model_number || 'Standard',
        quantity: 1,
        ac_type: (item.category_name || '').toUpperCase().includes('AC') ? (item.ac_type || 'in_out') : undefined
      });
      
      // Sync local storage
      const localBrandsStr = localStorage.getItem('spil_category_brands');
      if (localBrandsStr) {
        try {
          const parsed = JSON.parse(localBrandsStr);
          const catKey = (item.category_name || '').toLowerCase();
          if (parsed[catKey]) {
            const existingBrand = parsed[catKey].find(b => 
              (b.brand || '').toLowerCase() === (item.brand || '').toLowerCase() &&
              (b.model_number || '').toLowerCase() === (item.original_model || item.model_number || '').toLowerCase()
            );
            if (existingBrand) {
              existingBrand.stock = (parseInt(existingBrand.stock) || 0) + 1;
              localStorage.setItem('spil_category_brands', JSON.stringify(parsed));
            }
          }
        } catch(e) {}
      }
      
      showToast(`1 Stok ${item.brand || ''} berhasil ditambahkan`, 'success');
      fetchData(false);
    } catch (err) {
      showToast('Gagal menambah stok', 'error');
    }
  };

  const handleQuickReduceStock = async (item, e) => {
    e.stopPropagation();
    if (item.stock <= 0) return;
    try {
      const result = await deleteOneAssetByBrand({
        category_id: item.category_id,
        brand: item.brand === 'Tanpa Merk' ? undefined : item.brand,
        model_number: item.model_number === 'Standard' ? undefined : item.model_number,
      });

      if (result.deleted > 0) {
        showToast(`1 Stok ${item.brand || ''} berhasil dikurangi`, 'success');
        fetchData(false);
      } else {
        showToast('Tidak ada stok tersedia untuk dikurangi', 'warning');
      }
    } catch (err) {
      const errMsg = Array.isArray(err.response?.data?.detail) 
        ? err.response.data.detail.map(d => d.msg).join(', ') 
        : (err.response?.data?.detail || err.message);
      showToast('Gagal mengurangi stok: ' + errMsg, 'error');
    }
  };


  const handleAddStockSubmit = async (e) => {
    e.preventDefault();
    if (!addStockModal || stockToAdd <= 0) return;
    
    try {
      await addStockToInventory({
        category_id: addStockModal.category_id,
        brand: addStockModal.brand,
        model_number: addStockModal.original_model || addStockModal.model_number || 'Standard',
        quantity: parseInt(stockToAdd),
        ac_type: (addStockModal.category_name || '').toUpperCase().includes('AC') ? acType : undefined
      });
      
      // Update local storage to keep it in sync
      const localBrandsStr = localStorage.getItem('spil_category_brands');
      if (localBrandsStr) {
        try {
          const parsed = JSON.parse(localBrandsStr);
          const catKey = (addStockModal.category_name || '').toLowerCase();
          if (parsed[catKey]) {
            const existingBrand = parsed[catKey].find(b => 
              (b.brand || '').toLowerCase() === (addStockModal.brand || '').toLowerCase() &&
              (b.model_number || '').toLowerCase() === (addStockModal.original_model || addStockModal.model_number || '').toLowerCase()
            );
            if (existingBrand) {
              existingBrand.stock = (parseInt(existingBrand.stock) || 0) + parseInt(stockToAdd);
              localStorage.setItem('spil_category_brands', JSON.stringify(parsed));
            }
          }
        } catch(e) {}
      }
      
      showToast(`Berhasil menambah ${stockToAdd} stok untuk ${addStockModal.brand}`, 'success');
      setAddStockModal(null);
      setStockToAdd(1);
      fetchData(false);
    } catch (err) {
      console.error(err);
      showToast('Gagal menambah stok', 'error');
    }
  };

  const handleRestoreDamaged = async (item) => {
    try {
      if (item.is_local) {
        // Remove from spil_damaged_inventory
        const localDamagedStr = localStorage.getItem('spil_damaged_inventory');
        if (localDamagedStr) {
          try {
            const parsed = JSON.parse(localDamagedStr);
            const originalData = item.original_local_data;
            const updatedDamaged = parsed.filter(d => 
              !(d.category_id === originalData.category_id && 
                d.brand === originalData.brand && 
                d.model_number === originalData.model_number && 
                d.unassigned_at === originalData.unassigned_at)
            );
            localStorage.setItem('spil_damaged_inventory', JSON.stringify(updatedDamaged));
          } catch(e) { console.error(e) }
        }
        
        // Add back to spil_category_brands
        const localBrandsStr = localStorage.getItem('spil_category_brands');
        if (localBrandsStr) {
          try {
            const parsed = JSON.parse(localBrandsStr);
            const catKey = (item.category_name || '').toLowerCase();
            if (!parsed[catKey]) parsed[catKey] = [];
            
            const existingBrand = parsed[catKey].find(b => 
              (b.brand || '').toLowerCase() === (item.brand || '').toLowerCase() &&
              (b.model_number || '').toLowerCase() === (item.model_number || '').toLowerCase()
            );
            
            if (existingBrand) {
              existingBrand.stock = (parseInt(existingBrand.stock) || 0) + 1;
            } else {
              parsed[catKey].push({
                id: `b_${Date.now()}`,
                category_id: item.category_id,
                brand: item.brand,
                model_number: item.model_number,
                stock: 1,
                min_stock: 1,
                warranty_months: 0
              });
            }
            localStorage.setItem('spil_category_brands', JSON.stringify(parsed));
          } catch(e) { console.error(e) }
        }
      } else {
        await restoreAsset({
          asset_id: item.asset_id || item.id,
          category_id: item.category_id,
          brand: item.brand,
          model_number: item.model_number
        });
      }

      showToast('Barang berhasil diperbaiki & masuk ke Siap Pakai', 'success');
      await fetchData(false);
    } catch (e) {
      console.error(e);
      showToast('Gagal memulihkan barang', 'error');
    }
  };

  const handleDeleteDamagedConfirm = async () => {
    if (!confirmDeleteDamaged) return;
    try {
      const item = confirmDeleteDamaged;
      
      if (item.is_local) {
        const localDamagedStr = localStorage.getItem('spil_damaged_inventory');
        if (localDamagedStr) {
          try {
            const parsed = JSON.parse(localDamagedStr);
            const originalData = item.original_local_data;
            const updatedDamaged = parsed.filter(d => 
              !(d.category_id === originalData.category_id && 
                d.brand === originalData.brand && 
                d.model_number === originalData.model_number && 
                d.unassigned_at === originalData.unassigned_at)
            );
            localStorage.setItem('spil_damaged_inventory', JSON.stringify(updatedDamaged));
          } catch(e) { console.error(e) }
        }
      } else {
        await deleteAsset(item.id);
      }

      showToast('Barang rusak berhasil dibuang', 'success');
      setConfirmDeleteDamaged(null);
      fetchData(false);
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
    <div className="mobile-p-sm" style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
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
      <div className="mobile-col" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div className="mobile-col mobile-w-full" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            className="mobile-w-full mobile-text-center"
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
            className="mobile-w-full mobile-text-center"
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
        <div className="mobile-col mobile-w-full" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="mobile-w-full" style={{ display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: '12px', background: '#ffffff', border: '1.5px solid #cbd5e1', width: '280px', height: '44px', boxSizing: 'border-box', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
            <Search size={18} color="#64748b" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input 
              type="text"
              placeholder="Cari merk, tipe, atau ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '0.95rem', color: '#0f172a', fontWeight: '600' }}
            />
          </div>

          {(isAdmin && activeTab === 'good' && !selectedCategoryView) && (
            <button
              onClick={handleOpenAddCategoryModal}
              className="neu-action-btn mobile-w-full mobile-text-center"
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
      <div className="neu-inset mobile-p-sm" style={{ padding: '24px', borderRadius: '18px', background: 'rgba(255,255,255,0.6)', border: '1px solid #e2e8f0', minHeight: '400px' }}>
        
        {(activeTab === 'category' || activeTab === 'good') && (
          <div>
            {!selectedCategoryView ? (
              // CATEGORY GRID VIEW (Bold, Crisp & Prominent!)
              <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '20px' }}>
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
                            {catBrands.some(b => b.stock <= (b.min_stock || 0)) && (
                              <span style={{ 
                                padding: '4px 10px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '800',
                                background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex', alignItems: 'center', gap: '4px'
                              }} title="Ada barang yang stoknya kurang dari atau sama dengan minimum stok!">
                                <AlertTriangle size={14} /> Stok Minim
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action edit/delete - Admin Only */}
                      {isAdmin && (
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
                      )}
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

                  {isAdmin && (
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
                  )}
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
                  <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
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
                            {isAdmin && (
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
                            )}
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

                          {isAdmin && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setAddStockModal(item); setAcType(item.ac_type || 'in_out'); }}
                                style={{ 
                                  flex: 1, padding: '10px', borderRadius: '10px', 
                                  background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                  fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
                                title="Input manual banyak stok sekaligus"
                              >
                                <Plus size={16} /> Stok Masal
                              </button>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={(e) => handleQuickReduceStock(item, e)}
                                  disabled={item.stock <= 0}
                                  style={{ 
                                    width: '42px', height: '100%', borderRadius: '10px', 
                                    background: item.stock <= 0 ? '#f8fafc' : '#fee2e2', 
                                    color: item.stock <= 0 ? '#cbd5e1' : '#ef4444', 
                                    border: item.stock <= 0 ? '1px solid #e2e8f0' : 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    cursor: item.stock <= 0 ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                  title="Kurangi 1 Stok"
                                >
                                  <Minus size={18} />
                                </button>
                                
                                <button 
                                  onClick={(e) => handleQuickAddStock(item, e)}
                                  style={{ 
                                    width: '42px', height: '100%', borderRadius: '10px', 
                                    background: '#dcfce7', color: '#22c55e', border: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    cursor: 'pointer', transition: 'all 0.2s',
                                  }}
                                  title="Tambah 1 Stok"
                                >
                                  <Plus size={18} />
                                </button>
                              </div>
                            </div>
                          )}
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
                                {it.ac_type && it.ac_type !== 'in_out' ? (
                                  <span style={{ marginLeft: '8px', padding: '2px 6px', background: 'var(--color-primary)', color: 'white', fontSize: '0.7rem', borderRadius: '4px' }}>
                                    {it.ac_type.toUpperCase()}
                                  </span>
                                ) : null}
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
              <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
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

              { (selectedCategoryView?.name || '').toUpperCase().includes('AC') && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)' }}>
                    Bagian AC yang ditambahkan
                  </label>
                  <select
                    value={brandForm.ac_type}
                    onChange={(e) => setBrandForm({ ...brandForm, ac_type: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.95rem', outline: 'none', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                  >
                    <option value="in_out">Keduanya (Unit Dalam & Kompresor)</option>
                    <option value="in">Hanya Unit Dalam (IN)</option>
                    <option value="out">Hanya Kompresor (OUT)</option>
                  </select>
                </div>
              )}

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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)' }}>
                    Masa Garansi (Bulan)
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="0 jika tanpa garansi"
                    value={brandForm.warranty_months}
                    onChange={(e) => setBrandForm({ ...brandForm, warranty_months: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)' }}>
                    Tanggal Pembelian
                  </label>
                  <input 
                    type="date" 
                    value={brandForm.purchase_date}
                    onChange={(e) => setBrandForm({ ...brandForm, purchase_date: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)' }}>
                    Tanggal Kedaluwarsa (Opsional)
                  </label>
                  <input 
                    type="date" 
                    value={brandForm.expired_date || ''}
                    onChange={(e) => setBrandForm({ ...brandForm, expired_date: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  {[
                    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', 
                    '#22c55e', '#10b981', '#14b8a6', '#0ea5e9', '#3b82f6', 
                    '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#64748b'
                  ].map(c => (
                    <div 
                      key={c}
                      onClick={() => setCatColor(c)}
                      style={{
                        width: '30px', height: '30px', borderRadius: '50%', backgroundColor: c,
                        cursor: 'pointer',
                        border: catColor === c ? '2px solid white' : '2px solid transparent',
                        boxShadow: catColor === c ? `0 0 0 2px ${c}` : '0 2px 4px rgba(0,0,0,0.1)',
                        transform: catColor === c ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.2s ease'
                      }}
                      title={c}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>Warna Kustom:</span>
                  <div style={{ 
                    width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '2px solid white'
                  }}>
                    <input 
                      type="color" 
                      value={catColor}
                      onChange={(e) => setCatColor(e.target.value)}
                      style={{ width: '150%', height: '150%', margin: '-25%', padding: 0, border: 'none', cursor: 'pointer' }}
                    />
                  </div>
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
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>
                  Jumlah Stok Baru
                </label>
                <input 
                  type="number" 
                  min="1"
                  value={stockToAdd}
                  onChange={(e) => setStockToAdd(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '1rem', outline: 'none' }}
                  autoFocus
                  required
                />
              </div>

              {(addStockModal.category_name || '').toUpperCase().includes('AC') && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>
                    Unit AC
                  </label>
                  <select
                    value={acType}
                    onChange={(e) => setAcType(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '1rem', outline: 'none', background: 'white' }}
                  >
                    <option value="in_out">Keduanya (Indoor + Outdoor)</option>
                    <option value="in">Indoor Saja</option>
                    <option value="out">Outdoor Saja</option>
                  </select>
                </div>
              )}

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
