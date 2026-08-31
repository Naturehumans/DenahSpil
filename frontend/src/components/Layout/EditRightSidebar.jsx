import React, { useState, useRef } from 'react';
import { Target, X, Trash2 } from 'lucide-react';

const EditRightSidebar = ({ isOpen, onClose, categories = [], slots = [], onDeleteSlot, onSelectMobileSlotTemplate }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories.length > 0 ? categories[0].id : '');
  const touchStartPos = useRef({ x: 0, y: 0 });
  const isTouchMoving = useRef(false);

  const handleItemSelect = (cat) => {
    setSelectedCategoryId(cat.id);
    if (onSelectMobileSlotTemplate) {
      onSelectMobileSlotTemplate(cat);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      isTouchMoving.current = false;
    }
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    if (touch) {
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 8 || dy > 8) {
        isTouchMoving.current = true;
      }
    }
  };

  const handleTouchEnd = (e, cat) => {
    if (!isTouchMoving.current) {
      e.preventDefault();
      handleItemSelect(cat);
    }
  };

  return (
    <aside 
      className="right-sidebar"
      style={{
        width: '300px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Target size={24} />
          <span>Template Slot</span>
        </h2>
        <button id="alert-btn" onClick={onClose} style={{ display: 'none', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
          <X size={24} />
        </button>
      </div>

      <div className="neu-inset" style={{ padding: '16px', borderRadius: '12px' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
          Pilih Kategori Slot
        </label>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {categories.map(cat => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <div
                key={cat.id}
                className="neu-inset"
                style={{
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderRadius: '8px',
                  border: isSelected ? `2px solid ${cat.color || '#3b82f6'}` : '2px solid transparent',
                  background: isSelected ? 'rgba(58, 149, 66, 0.08)' : 'transparent',
                  transition: 'background 0.2s ease, border 0.2s ease',
                  cursor: 'pointer',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'pan-y'
                }}
                onClick={() => handleItemSelect(cat)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={(e) => handleTouchEnd(e, cat)}
              >
                <div 
                  draggable={true}
                  onDragStart={(e) => {
                    setSelectedCategoryId(cat.id);
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      type: 'slot-template',
                      categoryId: cat.id
                    }));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    border: `2px dashed ${cat.color || '#3b82f6'}`,
                    color: cat.color || '#3b82f6',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    cursor: 'grab',
                    flexShrink: 0
                  }}
                >
                  {cat.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                    {cat.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    (Klik / Ketuk untuk menempatkan)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '4px', marginTop: '8px' }}>Daftar Slot di Lantai Ini</h3>
        
        {slots.map(slot => {
          const isFilled = slot.equipment_id != null;
          return (
            <div 
              key={slot.id}
              className="neu-raised-sm" 
              style={{ 
                padding: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                background: 'transparent',
                border: '1px solid transparent'
              }}
            >
              <div style={{ 
                width: '24px', height: '24px', borderRadius: '50%', 
                background: isFilled ? (slot.category?.color || '#3b82f6') : 'transparent',
                border: isFilled ? 'none' : `2px dashed ${slot.category?.color || '#3b82f6'}`,
                color: isFilled ? 'white' : (slot.category?.color || '#3b82f6'), 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '0.75rem', flexShrink: 0
              }}>
                {isFilled ? '✓' : slot.category?.name?.charAt(0).toUpperCase()}
              </div>
              
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '0.8rem', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {isFilled ? slot.equipment?.name : `Slot ${slot.category?.name}`}
                </p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                  {isFilled ? 'Terisi' : 'Kosong'}
                </p>
              </div>

              {!isFilled && (
                <button 
                  onClick={() => onDeleteSlot(slot.id)}
                  className="neu-action-btn"
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                  title="Hapus Slot"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          );
        })}
        {slots.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Tidak ada slot di lantai ini.</p>
        )}
      </div>
    </aside>
  );
};

export default EditRightSidebar;
