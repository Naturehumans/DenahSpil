import React, { useState } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import { Upload, Trash2, Edit2, ArrowUp, ArrowDown, Check, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../UI/ConfirmModal';

const FloorForm = ({ floors = [], onSubmit, onUpdate, onDelete, onReorder, onCancel }) => {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { showToast } = useToast();

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      showToast('Denah lantai (gambar) wajib diisi', 'error');
      return;
    }
    
    let nextIndex = floors.length + 1;
    let autoName = `Lt.${nextIndex}`;
    while (floors.some(f => f.name.toLowerCase() === autoName.toLowerCase())) {
      nextIndex++;
      autoName = `Lt.${nextIndex}`;
    }
    
    onSubmit({ name: autoName, file });
    setFile(null);
  };

  const handleEditClick = (floor) => {
    setEditingId(floor.id);
    setEditName(floor.name);
  };

  const handleSaveEdit = async (floor) => {
    if (!editName.trim()) {
      showToast('Nama lantai tidak boleh kosong', 'error');
      return;
    }
    if (editName !== floor.name) {
      await onUpdate(floor.id, { name: editName });
    }
    setEditingId(null);
  };

  const handleDelete = (id) => {
    setConfirmDeleteId(id);
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newFloors = [...floors];
    const temp = newFloors[index - 1];
    newFloors[index - 1] = newFloors[index];
    newFloors[index] = temp;
    onReorder(newFloors);
  };

  const handleMoveDown = (index) => {
    if (index === floors.length - 1) return;
    const newFloors = [...floors];
    const temp = newFloors[index + 1];
    newFloors[index + 1] = newFloors[index];
    newFloors[index] = temp;
    onReorder(newFloors);
  };

  return (
    <div className="responsive-grid-2" style={{ minHeight: '400px' }}>
      
      {/* KIRI: List Lantai (Manajemen) */}
      <div className="responsive-border-right" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderRight: '1px solid var(--color-bg)', paddingRight: '24px' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--color-primary)', margin: '0 0 8px 0' }}>Daftar Lantai</h3>
        
        {floors.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Belum ada lantai. Silakan tambahkan di sebelah kanan.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '400px', paddingRight: '8px' }}>
            {floors.map((floor, index) => (
              <div key={floor.id} className="neu-inset" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                
                {/* Bagian Kiri Item (Teks atau Form Edit) */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  {editingId === floor.id ? (
                    <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                      <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ 
                          flex: 1, padding: '4px 8px', borderRadius: '4px', 
                          border: '1px solid var(--color-text-muted)', outline: 'none'
                        }}
                        autoFocus
                      />
                      <button onClick={() => handleSaveEdit(floor)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-success)', padding: '4px' }}>
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text)' }}>{floor.name}</span>
                  )}
                </div>

                {/* Tombol Aksi */}
                {editingId !== floor.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', marginRight: '4px' }}>
                      <button 
                        onClick={() => handleMoveUp(index)} 
                        disabled={index === 0}
                        style={{ background: 'transparent', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', color: index === 0 ? 'var(--color-text-muted)' : 'var(--color-primary)', padding: '2px' }}
                        title="Naikkan urutan"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button 
                        onClick={() => handleMoveDown(index)} 
                        disabled={index === floors.length - 1}
                        style={{ background: 'transparent', border: 'none', cursor: index === floors.length - 1 ? 'not-allowed' : 'pointer', color: index === floors.length - 1 ? 'var(--color-text-muted)' : 'var(--color-primary)', padding: '2px' }}
                        title="Turunkan urutan"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    <button 
                      onClick={() => handleEditClick(floor)}
                      className="neu-raised-sm"
                      style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-warning)' }}
                      title="Edit Nama"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(floor.id)}
                      className="neu-raised-sm"
                      style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}
                      title="Hapus Lantai"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KANAN: Form Tambah Lantai */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--color-primary)', margin: '0 0 16px 0' }}>Tambah Lantai Baru</h3>
        
        <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>


          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>
              Denah Lantai (Gambar) <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            
            <div className="neu-inset" style={{
              border: '2px dashed var(--color-text-muted)',
              padding: '24px',
              textAlign: 'center',
              borderRadius: '12px',
              cursor: 'pointer',
              position: 'relative'
            }}>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setFile(e.target.files[0])}
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  opacity: 0,
                  cursor: 'pointer'
                }}
                required
              />
              <Upload size={24} color="var(--color-text-muted)" style={{ marginBottom: '8px' }} />
              <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                {file ? file.name : "Klik atau seret gambar ke sini"}
              </p>
            </div>
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
        }}
        title="Hapus Lantai"
        message="Apakah Anda yakin ingin menghapus lantai ini? Semua barang dan data di dalamnya akan ikut terhapus!"
      />
    </div>
  );
};

export default FloorForm;
