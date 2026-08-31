import React, { useState } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import { Trash2, Edit2, Check, X, ArrowLeft, Building2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../UI/ConfirmModal';
import FloorForm from './FloorForm';

const AreaManagement = ({ 
  buildings = [],
  floors = [],
  currentBuilding,
  onCreateBuilding,
  onUpdateBuilding,
  onDeleteBuilding,
  onSelectBuilding,
  onCreateFloor,
  onUpdateFloor,
  onDeleteFloor,
  onReorderFloors,
  onCancel
}) => {
  const [view, setView] = useState('areas'); // 'areas' or 'floors'
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  
  const { showToast } = useToast();

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama area wajib diisi', 'error');
      return;
    }
    onCreateBuilding({ name });
    setName('');
  };

  const handleEditClick = (bldg) => {
    setEditingId(bldg.id);
    setEditName(bldg.name);
  };

  const handleSaveEdit = async (bldg) => {
    if (!editName.trim()) {
      showToast('Nama area tidak boleh kosong', 'error');
      return;
    }
    if (editName !== bldg.name) {
      await onUpdateBuilding(bldg.id, { name: editName });
    }
    setEditingId(null);
  };

  const handleSelectArea = (bldgId) => {
    if (currentBuilding?.id !== bldgId) {
      onSelectBuilding(bldgId);
    }
    setView('floors');
  };

  if (view === 'floors' && currentBuilding) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setView('areas')}
            className="neu-raised-sm"
            style={{ 
              padding: '8px', 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer', 
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px'
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>
            Area: {currentBuilding.name}
          </h3>
        </div>
        
        <FloorForm 
          floors={floors}
          onSubmit={onCreateFloor}
          onUpdate={onUpdateFloor}
          onDelete={onDeleteFloor}
          onReorder={onReorderFloors}
          onCancel={onCancel}
        />
      </div>
    );
  }

  // view === 'areas'
  return (
    <div className="responsive-grid-2" style={{ minHeight: '400px' }}>
      
      {/* KIRI: List Area (Manajemen) */}
      <div className="responsive-border-right" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRight: '1px solid var(--color-bg)', paddingRight: '24px' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--color-primary)', margin: '0' }}>Daftar Area / Gedung</h3>
        
        {buildings.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Belum ada area. Silakan tambahkan di sebelah kanan.</p>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
            gap: '12px', 
            overflowY: 'auto', 
            maxHeight: '400px', 
            paddingRight: '8px',
            alignContent: 'start'
          }}>
            {buildings.map((bldg) => (
              <div 
                key={bldg.id} 
                className="neu-raised-sm" 
                style={{ 
                  padding: '16px', 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '12px', 
                  borderRadius: '12px',
                  background: currentBuilding?.id === bldg.id ? 'var(--color-primary-light)' : 'transparent',
                  border: currentBuilding?.id === bldg.id ? '1px solid var(--color-primary)' : '1px solid transparent',
                }}
              >
                
                <div 
                  onClick={() => handleSelectArea(bldg.id)}
                  style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}
                >
                  <Building2 size={32} color={currentBuilding?.id === bldg.id ? 'var(--color-primary)' : 'var(--color-text-secondary)'} />
                  
                  {editingId === bldg.id ? (
                    <div style={{ display: 'flex', gap: '4px', width: '100%', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                      <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ 
                          width: '100%', padding: '4px 8px', borderRadius: '4px', 
                          border: '1px solid var(--color-text-muted)', outline: 'none',
                          fontSize: '0.875rem', textAlign: 'center'
                        }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span style={{ fontWeight: '600', fontSize: '0.9rem', color: currentBuilding?.id === bldg.id ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                      {bldg.name}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderTop: '1px solid var(--color-bg)', paddingTop: '8px' }} onClick={e => e.stopPropagation()}>
                  {editingId === bldg.id ? (
                    <>
                      <button onClick={() => handleSaveEdit(bldg)} className="neu-action-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-success)', padding: '4px' }}>
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="neu-action-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }}>
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleEditClick(bldg)}
                        className="neu-action-btn"
                        style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-warning)' }}
                        title="Edit Nama"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setConfirmDeleteId(bldg.id)}
                        className="neu-action-btn"
                        style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}
                        title="Hapus Area"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KANAN: Form Tambah Area */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--color-primary)', margin: '0 0 16px 0' }}>Tambah Area Baru</h3>
        
        <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          <Input
            label="Nama Area / Gedung"
            placeholder="Contoh: Gedung Utama"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

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
          if (confirmDeleteId) onDeleteBuilding(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        title="Hapus Area"
        message="Apakah Anda yakin ingin menghapus Area ini? Semua lantai dan barang di dalamnya akan ikut terhapus permanen!"
      />
    </div>
  );
};

export default AreaManagement;
