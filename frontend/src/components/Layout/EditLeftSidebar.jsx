import React from 'react';
import { Package, X } from 'lucide-react';

const EditLeftSidebar = ({ 
  isOpen, onClose, categories = [],
  buildings = [], currentBuilding, onSelectBuilding,
  floors = [], currentFloor, onSelectFloor,
  isDrawingPolygon, setIsDrawingPolygon,
  currentPolygon, setCurrentPolygon, onPolygonComplete
}) => {
  const [expandedBuildingId, setExpandedBuildingId] = React.useState(null);

  React.useEffect(() => {
    if (currentBuilding) {
      setExpandedBuildingId(currentBuilding.id);
    }
  }, [currentBuilding]);

  const handleDragStart = (e, category) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'stock-item',
      categoryId: category.id
    }));
    e.dataTransfer.effectAllowed = 'copy';

    if (onClose) {
      setTimeout(() => {
        onClose();
      }, 50);
    }
  };

  return (
    <aside 
      className="left-sidebar"
      style={{
        width: '280px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        borderRight: '1px solid var(--color-bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Package size={24} />
          <span>Stok Barang</span>
        </h2>
        <button id="mobile-menu-btn" onClick={onClose} style={{ display: 'none', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
          <X size={24} />
        </button>
      </div>

      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
        Tarik (drag) barang dari sini dan lepaskan di atas slot template yang sesuai.
      </div>

      {/* Area & Floor Accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: '250px' }}>
        <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Area & Lantai</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px', paddingBottom: '4px' }}>
          {buildings.map(bldg => {
            const isExpanded = expandedBuildingId === bldg.id;
            
            return (
              <div key={bldg.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Area Header (Accordion Button) */}
                <button 
                  onClick={() => {
                    if (isExpanded) {
                      setExpandedBuildingId(null);
                    } else {
                      setExpandedBuildingId(bldg.id);
                      if (currentBuilding?.id !== bldg.id) {
                        onSelectBuilding(bldg.id);
                      }
                    }
                  }}
                  className={(currentBuilding?.id === bldg.id) ? "neu-inset" : "neu-raised-sm"} 
                  style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    color: (currentBuilding?.id === bldg.id) ? 'var(--color-primary)' : 'var(--color-text-primary)', 
                    fontWeight: '700', 
                    border: 'none', 
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{bldg.name}</span>
                  <svg 
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {/* Floors Dropdown List */}
                {(isExpanded && currentBuilding?.id === bldg.id) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '16px', marginTop: '2px' }}>
                    {floors.map(floor => {
                      const isActive = currentFloor?.id === floor.id;
                      return (
                        <button 
                          key={floor.id}
                          onClick={() => onSelectFloor(floor)}
                          className={isActive ? "neu-inset" : "neu-raised-sm"} 
                          style={{ 
                            padding: '10px 16px', 
                            textAlign: 'left', 
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)', 
                            fontWeight: isActive ? '600' : '500', 
                            border: 'none', 
                            background: 'transparent',
                            cursor: 'pointer',
                            borderRadius: '10px'
                          }}
                        >
                          {floor.name}
                        </button>
                      );
                    })}
                    {floors.length === 0 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px 0' }}>Belum ada lantai</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
          {buildings.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Tidak ada Area</p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        {!isDrawingPolygon ? (
          <button
            className="neu-raised-sm"
            onClick={() => setIsDrawingPolygon(true)}
            style={{
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
              fontWeight: '600',
              marginBottom: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h6v6H3z"></path>
              <path d="M15 3h6v6h-6z"></path>
              <path d="M15 15h6v6h-6z"></path>
              <path d="M3 15h6v6H3z"></path>
              <path d="M9 6h6"></path>
              <path d="M9 18h6"></path>
              <path d="M6 9v6"></path>
              <path d="M18 9v6"></path>
            </svg>
            Buat Ruangan / Area
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textAlign: 'center', margin: 0 }}>
              Klik pada denah untuk menggambar batas area. (Titik: {currentPolygon?.length || 0})
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="neu-raised-sm"
                onClick={() => {
                  setIsDrawingPolygon(false);
                  setCurrentPolygon([]);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'transparent',
                  border: '1px solid var(--color-danger, #ef4444)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'var(--color-danger, #ef4444)',
                  fontWeight: '600',
                }}
              >
                Batal
              </button>
              <button
                className="neu-raised-sm"
                disabled={!currentPolygon || currentPolygon.length < 3}
                onClick={() => {
                  if (currentPolygon && currentPolygon.length >= 3) {
                    onPolygonComplete(currentPolygon);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: (!currentPolygon || currentPolygon.length < 3) ? 'rgba(0,0,0,0.1)' : 'var(--color-primary)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!currentPolygon || currentPolygon.length < 3) ? 'not-allowed' : 'pointer',
                  color: (!currentPolygon || currentPolygon.length < 3) ? 'var(--color-text-muted)' : 'white',
                  fontWeight: '600',
                }}
              >
                Simpan
              </button>
            </div>
          </div>
        )}

        {categories.map(cat => {
          let availableStock = cat.available_stock;
          if (availableStock === undefined || availableStock === null) {
            availableStock = cat.initial_stock || 0;
          }

          const isOutOfStock = availableStock <= 0;
          return (
            <div 
              key={cat.id}
              className={`neu-raised-sm ${isOutOfStock ? '' : 'neu-action-btn'}`}
              style={{ 
                padding: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                background: 'transparent',
                border: '1px solid transparent',
              }}
            >
              <div 
                draggable={!isOutOfStock}
                onDragStart={(e) => handleDragStart(e, cat)}
                style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: `${cat.color || '#3b82f6'}30`, 
                  color: cat.color || '#3b82f6', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '1rem', flexShrink: 0,
                  cursor: isOutOfStock ? 'not-allowed' : 'grab',
                  opacity: isOutOfStock ? 0.6 : 1,
                }}>
                {cat.name.charAt(0).toUpperCase()}
              </div>
              
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{cat.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold',
                    color: isOutOfStock ? 'var(--color-danger)' : 'var(--color-success)',
                    background: isOutOfStock ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}>
                    Tersedia: {availableStock}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {categories.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Tidak ada data kategori.</p>
        )}
      </div>
    </aside>
  );
};

export default EditLeftSidebar;
