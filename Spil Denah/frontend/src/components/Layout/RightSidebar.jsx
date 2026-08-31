import React, { useRef } from 'react';
import Badge from '../UI/Badge';

const RightSidebar = ({ isOpen, onClose, equipments = [], onEquipmentClick, onEquipmentDoubleClick }) => {
  const clickTimeout = useRef(null);

  const handleItemClick = (eq) => {
    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
      clickTimeout.current = null;
      if (onEquipmentDoubleClick) onEquipmentDoubleClick(eq);
    } else {
      clickTimeout.current = setTimeout(() => {
        if (onEquipmentClick) onEquipmentClick(eq);
        clickTimeout.current = null;
      }, 250);
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
        transition: 'transform 0.3s ease',
      }}
    >
      <div className="neu-raised" style={{ padding: '16px', flex: '1', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
        <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Daftar Barang</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px', paddingBottom: '4px', flex: 1 }}>
          {equipments.map(eq => (
            <div key={eq.id} 
              onClick={() => handleItemClick(eq)} 
              className="neu-raised-sm neu-action-btn" 
              style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flexShrink: 0, background: 'transparent' }}
            >
              <div style={{ 
                width: '36px', height: '36px', borderRadius: '50%', 
                background: `${eq.category?.color || '#3b82f6'}20`, 
                color: eq.category?.color || '#3b82f6', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                fontWeight: 'bold', fontSize: '1rem'
              }}>
                {eq.category?.name ? eq.category.name.charAt(0).toUpperCase() : 'B'}
              </div>
              <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '0.875rem', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{eq.name}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{eq.brand || eq.category?.name || 'Unknown'}</p>
              </div>
            </div>
          ))}
          
          {equipments.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '16px' }}>Tidak ada barang pada kategori ini.</p>
          )}
        </div>
      </div>
    </aside>
  );
};

export default RightSidebar;
