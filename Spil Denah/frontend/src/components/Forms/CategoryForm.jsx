import React, { useState, useEffect } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import { Trash2, Edit2, Check, X, ArrowLeft, Tag, Layers, PlusCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../UI/ConfirmModal';

const CategoryForm = ({ categories = [], onSubmit, onUpdate, onDelete, onCancel }) => {
  const [view, setView] = useState('categories'); // 'categories' or 'brands'
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Form Tambah Kategori
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3a9542');
  const [hasId, setHasId] = useState(true);

  // Form Edit Kategori
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', color: '', has_id: false });

  // Form Tambah Merk
  const [brandName, setBrandName] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [brandStock, setBrandStock] = useState('5');
  const [brandMinStock, setBrandMinStock] = useState('1');
  const [brandWarrantyMonths, setBrandWarrantyMonths] = useState('0');

  // Form Edit Merk
  const [editingBrandId, setEditingBrandId] = useState(null);
  const [editBrandData, setEditBrandData] = useState({ brand: '', model_number: '', stock: 0, min_stock: 0, warranty_months: 0 });

  // Brands store state (persisted per category in localStorage)
  const [categoryBrandsMap, setCategoryBrandsMap] = useState(() => {
    try {
      const saved = localStorage.getItem('spil_category_brands');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    
    // Default initial mock brands for pre-existing categories
    return {
      'ac': [
        { id: 'b1', brand: 'LG', model_number: 'Inverter 1PK', stock: 3, min_stock: 1 },
        { id: 'b2', brand: 'Panasonic', model_number: 'Standard 2PK', stock: 3, min_stock: 1 }
      ],
      'lampu': [
        { id: 'b3', brand: 'Philips', model_number: 'LED 14W', stock: 9, min_stock: 3 }
      ],
      'kipas angin': [
        { id: 'b4', brand: 'Miyako', model_number: 'Stand Fan 16"', stock: 9, min_stock: 2 }
      ],
      'proyektor': [
        { id: 'b5', brand: 'Epson', model_number: 'EB-X500', stock: 10, min_stock: 2 }
      ]
    };
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeleteBrandId, setConfirmDeleteBrandId] = useState(null);
  const { showToast } = useToast();

  // Save brands to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('spil_category_brands', JSON.stringify(categoryBrandsMap));
    } catch (e) {}
  }, [categoryBrandsMap]);

  // Helper to get brands for a category
  const getBrandsForCategory = (cat) => {
    if (!cat) return [];
    const key = (cat.name || '').toLowerCase();
    return categoryBrandsMap[key] || categoryBrandsMap[cat.id] || [];
  };

  // Helper to calculate total stock for a category
  const getCategoryTotalStock = (cat) => {
    const brands = getBrandsForCategory(cat);
    if (brands.length > 0) {
      return brands.reduce((acc, b) => acc + (parseInt(b.stock) || 0), 0);
    }
    return cat.initial_stock || 0;
  };

  // Handle Tambah Kategori Submit
  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama kategori wajib diisi', 'error');
      return;
    }
    onSubmit({
      name,
      color,
      initial_stock: 0,
      minimum_stock: 0,
      has_id: hasId
    });
    setName('');
    setColor('#3a9542');
    setHasId(true);
  };

  // Handle Edit Kategori
  const handleEditClick = (category) => {
    setEditingId(category.id);
    setEditData({
      name: category.name,
      color: category.color || '#3a9542',
      has_id: category.has_id || false
    });
  };

  const handleSaveEdit = async (category) => {
    if (!editData.name.trim()) {
      showToast('Nama kategori tidak boleh kosong', 'error');
      return;
    }
    const changes = {};
    if (editData.name !== category.name) changes.name = editData.name;
    if (editData.color !== category.color) changes.color = editData.color;
    if (editData.has_id !== (category.has_id || false)) changes.has_id = editData.has_id;
    
    if (Object.keys(changes).length > 0) {
      await onUpdate(category.id, changes);
    }
    setEditingId(null);
  };

  // Select Category -> Go to Brands view
  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    setView('brands');
  };

  const handleAddBrandSubmit = (e) => {
    e.preventDefault();
    if (!selectedCategory) return;
    
    // Check if at least one of brand or model is provided
    if (!brandName.trim() && !modelNumber.trim()) {
      showToast('Merk atau tipe wajib diisi (salah satu)', 'error');
      return;
    }

    const key = (selectedCategory.name || '').toLowerCase();
    const existingBrands = categoryBrandsMap[key] || [];

    const newBrand = {
      id: `b_${Date.now()}`,
      brand: brandName.trim() || '-',
      model_number: modelNumber.trim() || 'Standard',
      stock: 0,
      min_stock: 0,
      warranty_months: parseInt(brandWarrantyMonths) || 0,
      created_at: new Date().toISOString()
    };

    const updatedBrands = [...existingBrands, newBrand];
    const newMap = { ...categoryBrandsMap, [key]: updatedBrands };
    setCategoryBrandsMap(newMap);

    // Sync total stock to category initial_stock
    const totalStock = updatedBrands.reduce((acc, b) => acc + b.stock, 0);
    onUpdate(selectedCategory.id, { initial_stock: totalStock });

    setBrandName('');
    setModelNumber('');
    setBrandWarrantyMonths('0');
    showToast(`Template Merk ${newBrand.brand} berhasil ditambahkan!`, 'success');
  };

  // Handle Save Edit Brand
  const handleSaveEditBrand = (brandId) => {
    if (!selectedCategory) return;
    const key = (selectedCategory.name || '').toLowerCase();
    const existingBrands = categoryBrandsMap[key] || [];

    const updatedBrands = existingBrands.map(b => {
      if (b.id === brandId) {
        return {
          ...b,
          brand: editBrandData.brand.trim() || b.brand,
          model_number: editBrandData.model_number.trim() || b.model_number,
          stock: parseInt(editBrandData.stock) || 0,
          min_stock: parseInt(editBrandData.min_stock) || 0,
          warranty_months: parseInt(editBrandData.warranty_months) || 0
        };
      }
      return b;
    });

    const newMap = { ...categoryBrandsMap, [key]: updatedBrands };
    setCategoryBrandsMap(newMap);

    const totalStock = updatedBrands.reduce((acc, b) => acc + b.stock, 0);
    onUpdate(selectedCategory.id, { initial_stock: totalStock });

    setEditingBrandId(null);
    showToast('Data merk berhasil diperbarui', 'success');
  };

  // Handle Delete Brand
  const handleDeleteBrandConfirm = (brandId) => {
    if (!selectedCategory) return;
    const key = (selectedCategory.name || '').toLowerCase();
    const existingBrands = categoryBrandsMap[key] || [];

    const updatedBrands = existingBrands.filter(b => b.id !== brandId);
    const newMap = { ...categoryBrandsMap, [key]: updatedBrands };
    setCategoryBrandsMap(newMap);

    const totalStock = updatedBrands.reduce((acc, b) => acc + b.stock, 0);
    onUpdate(selectedCategory.id, { initial_stock: totalStock });

    setConfirmDeleteBrandId(null);
    showToast('Merk berhasil dihapus', 'success');
  };

  // VIEW: BRANDS (Drill down per Category)
  if (view === 'brands' && selectedCategory) {
    const currentBrands = getBrandsForCategory(selectedCategory);
    const totalStock = getCategoryTotalStock(selectedCategory);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setView('categories')}
            className="neu-raised-sm"
            style={{ 
              padding: '8px 14px', 
              background: 'var(--color-bg)', 
              border: 'none', 
              cursor: 'pointer', 
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '0.875rem'
            }}
          >
            <ArrowLeft size={18} />
            <span>Kembali ke Kategori</span>
          </button>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: selectedCategory.color || '#3a9542' }} />
              Kategori: {selectedCategory.name}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              Kelola daftar merk, tipe/model, dan jumlah stok untuk kategori ini. Total Stok: <strong>{totalStock} unit</strong>
            </p>
          </div>
        </div>

        {/* Content 2 Columns */}
        <div className="responsive-grid-2" style={{ minHeight: '380px' }}>
          
          {/* KIRI: Daftar Merk & Model */}
          <div className="responsive-border-right" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderRight: '1px solid var(--color-bg)', paddingRight: '20px' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--color-primary)', margin: '0' }}>
              Daftar Merk ({currentBrands.length})
            </h4>

            {currentBrands.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                Belum ada merk untuk kategori ini. Silakan tambahkan merk di sebelah kanan.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '360px', paddingRight: '6px' }}>
                {currentBrands.map((item) => (
                  <div key={item.id} className="neu-inset" style={{ padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    
                    {editingBrandId === item.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            placeholder="Merk"
                            value={editBrandData.brand}
                            onChange={(e) => setEditBrandData({ ...editBrandData, brand: e.target.value })}
                            style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid var(--color-border)', outline: 'none', fontSize: '0.875rem' }}
                          />
                          <input 
                            type="text" 
                            placeholder="Tipe/Model"
                            value={editBrandData.model_number}
                            onChange={(e) => setEditBrandData({ ...editBrandData, model_number: e.target.value })}
                            style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid var(--color-border)', outline: 'none', fontSize: '0.875rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Stok:</span>
                            <input 
                              type="number" 
                              value={editBrandData.stock}
                              onChange={(e) => setEditBrandData({ ...editBrandData, stock: e.target.value })}
                              min="0"
                              style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>Garansi (Bulan):</span>
                            <input 
                              type="number" 
                              value={editBrandData.warranty_months}
                              onChange={(e) => setEditBrandData({ ...editBrandData, warranty_months: e.target.value })}
                              min="0"
                              style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => handleSaveEditBrand(item.id)} className="neu-action-btn" style={{ padding: '4px 8px', color: 'var(--color-success)' }}>
                              <Check size={16} />
                            </button>
                            <button onClick={() => setEditingBrandId(null)} className="neu-action-btn" style={{ padding: '4px 8px', color: 'var(--color-danger)' }}>
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '700', fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>
                            {item.brand} <span style={{ fontWeight: '400', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>({item.model_number})</span>
                          </div>
                          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(58, 149, 66, 0.12)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                              Stok: {item.stock} unit
                            </span>
                            {item.min_stock > 0 && item.stock <= item.min_stock && (
                              <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: '700' }}>
                                Stok Menipis (Min: {item.min_stock})
                              </span>
                            )}
                            {item.warranty_months > 0 && (
                              <span style={{ fontSize: '0.7rem', color: '#0ea5e9', fontWeight: '600' }}>
                                Garansi: {item.warranty_months} Bulan
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button 
                            onClick={() => {
                              setEditingBrandId(item.id);
                              setEditBrandData({ brand: item.brand, model_number: item.model_number, stock: item.stock, min_stock: item.min_stock, warranty_months: item.warranty_months || 0 });
                            }}
                            className="neu-action-btn"
                            style={{ padding: '6px', color: 'var(--color-warning)' }}
                            title="Edit Merk"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteBrandId(item.id)}
                            className="neu-action-btn"
                            style={{ padding: '6px', color: '#dc2626' }}
                            title="Hapus Merk"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KANAN: Form Tambah Merk Baru */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--color-primary)', margin: '0 0 14px 0' }}>
              Tambah Template Merk Baru
            </h4>

            <form onSubmit={handleAddBrandSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              <Input 
                label="Nama Merk / Brand" 
                placeholder="Contoh: Panasonic, LG, Daikin"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />

              <Input 
                label="Tipe / Model" 
                placeholder="Contoh: Inverter 1PK, Standard"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
              />



              <Input 
                type="number"
                label="Masa Garansi (Bulan) *Opsional" 
                placeholder="Contoh: 12"
                value={brandWarrantyMonths}
                onChange={(e) => setBrandWarrantyMonths(e.target.value)}
                min="0"
              />

              <div style={{ flex: 1 }}></div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <Button variant="ghost" type="button" onClick={() => setView('categories')}>Batal</Button>
                <Button variant="primary" type="submit">Tambah Merk</Button>
              </div>
            </form>
          </div>
        </div>

        <ConfirmModal 
          isOpen={confirmDeleteBrandId !== null}
          onClose={() => setConfirmDeleteBrandId(null)}
          onConfirm={() => {
            if (confirmDeleteBrandId) handleDeleteBrandConfirm(confirmDeleteBrandId);
          }}
          title="Hapus Merk"
          message="Apakah Anda yakin ingin menghapus merk ini? Stok merk ini akan dihapus dari kategori."
        />
      </div>
    );
  }

  // VIEW: CATEGORIES (Root View)
  return (
    <div className="responsive-grid-2" style={{ minHeight: '400px' }}>
      
      {/* KIRI: List Cards Kategori (Area Style) */}
      <div className="responsive-border-right" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRight: '1px solid var(--color-bg)', paddingRight: '24px' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--color-primary)', margin: '0' }}>Daftar Kategori Barang</h3>
        <p style={{ margin: '-10px 0 0 0', fontSize: '0.78125rem', color: 'var(--color-text-secondary)' }}>
          Klik pada kartu kategori untuk menginput merk & stok detail
        </p>
        
        {categories.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Belum ada kategori. Silakan tambahkan di sebelah kanan.</p>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', 
            gap: '10px', 
            overflowY: 'auto', 
            maxHeight: '440px', 
            paddingRight: '6px',
            alignContent: 'start'
          }}>
            {categories.map((category) => {
              const totalStock = getCategoryTotalStock(category);
              const brandCount = getBrandsForCategory(category).length;

              return (
                <div 
                  key={category.id} 
                  className="neu-raised-sm" 
                  style={{ 
                    padding: '10px 12px', 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px', 
                    borderRadius: '12px',
                    background: selectedCategory?.id === category.id ? 'rgba(58, 149, 66, 0.08)' : 'var(--color-bg)',
                    border: selectedCategory?.id === category.id ? '1px solid var(--color-primary)' : '1px solid transparent',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {editingId === category.id ? (
                    <div style={{ display: 'flex', gap: '6px', width: '100%', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                      <input 
                        type="text" 
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        style={{ 
                          flex: 1, padding: '4px 8px', borderRadius: '6px', 
                          border: '1px solid var(--color-primary)', outline: 'none',
                          fontSize: '0.85rem'
                        }}
                        autoFocus
                      />
                      <button onClick={() => handleSaveEdit(category)} className="neu-action-btn" style={{ padding: '4px', color: 'var(--color-success)' }}>
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="neu-action-btn" style={{ padding: '4px', color: 'var(--color-danger)' }}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Card Content Clickable */}
                      <div 
                        onClick={() => handleSelectCategory(category)}
                        style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}
                      >
                        <div style={{ 
                          width: '34px', 
                          height: '34px', 
                          borderRadius: '8px', 
                          backgroundColor: category.color || '#3a9542', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: 'white',
                          flexShrink: 0
                        }}>
                          <Tag size={16} />
                        </div>
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--color-text-primary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {category.name}
                          </span>
                          <div style={{ fontSize: '0.73rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                            <span style={{ color: 'var(--color-primary)', fontWeight: '700' }}>Stok: {totalStock}</span>
                            <span>•</span>
                            <span>{brandCount} Merk</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => handleEditClick(category)}
                          className="neu-action-btn"
                          style={{ padding: '4px 6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-warning)' }}
                          title="Edit Kategori"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => setConfirmDeleteId(category.id)}
                          className="neu-action-btn"
                          style={{ padding: '4px 6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}
                          title="Hapus Kategori"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KANAN: Form Tambah Kategori Baru (Sesuai Permintaan Awal) */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--color-primary)', margin: '0 0 16px 0' }}>Tambah Kategori Baru</h3>
        
        <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          <Input
            label="Nama Kategori"
            placeholder="Contoh: Lampu, AC, Kipas"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>Warna Penanda</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ 
                  width: '40px', 
                  height: '40px',
                  padding: '0',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{color}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>Pelacakan Aset Jangka Panjang</label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={hasId}
                onChange={(e) => setHasId(e.target.checked)}
                style={{ width: '18px', height: '18px', marginTop: '2px' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
                Centang jika barang ini adalah Aset ber-ID (misal: AC, CCTV). Biarkan kosong jika barang habis pakai (misal: Lampu).
              </span>
            </label>
          </div>

          <div style={{ flex: 1 }}></div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button variant="ghost" type="button" onClick={onCancel}>Tutup</Button>
            <Button variant="primary" type="submit">Tambah</Button>
          </div>
        </form>
      </div>

      <ConfirmModal 
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) onDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        title="Hapus Kategori"
        message="Apakah Anda yakin ingin menghapus kategori ini? Semua barang dengan kategori ini akan kehilangan label kategorinya!"
      />
    </div>
  );
};

export default CategoryForm;
