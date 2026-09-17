import React, { useState } from 'react';
import Input from '../UI/Input';
import { Search } from 'lucide-react';
import { getFloors } from '../../api/floors';
const LeftSidebar = ({ 
  isOpen, onClose, 
  buildings = [], currentBuilding, onSelectBuilding,
  floors = [], currentFloor, onSelectFloor, 
  categories = [], equipments = [],
  selectedCategoryIds = [], onSelectCategory
}) => {
  const [search, setSearch] = useState('');
  const [expandedBuildingIds, setExpandedBuildingIds] = React.useState([]);
  const [buildingFloors, setBuildingFloors] = React.useState({});

  React.useEffect(() => {
    if (currentBuilding && floors) {
      setBuildingFloors(prev => ({ ...prev, [currentBuilding.id]: floors }));
    }
  }, [currentBuilding, floors]);

  React.useEffect(() => {
    expandedBuildingIds.forEach(id => {
      if (!buildingFloors[id] && id !== currentBuilding?.id) {
        getFloors(id).then(flrs => {
          setBuildingFloors(prev => ({ ...prev, [id]: flrs }));
        }).catch(err => console.error(err));
      }
    });
  }, [expandedBuildingIds, currentBuilding, buildingFloors]);

  React.useEffect(() => {
    let buildingHoverTimer = null;
    let currentHoverBuildingId = null;

    const handleHoverBuilding = (e) => {
      const bldgId = e.detail;
      if (!bldgId || bldgId === currentHoverBuildingId) return;

      currentHoverBuildingId = bldgId;
      if (buildingHoverTimer) clearTimeout(buildingHoverTimer);

      buildingHoverTimer = setTimeout(() => {
        setExpandedBuildingIds(prev => prev.includes(bldgId) ? prev : [...prev, bldgId]);
        if (currentBuilding?.id !== bldgId) {
          onSelectBuilding(bldgId);
        }
      }, 400); // 400ms delay to match HTML5 hover
    };

    const handleHoverBuildingEnd = () => {
      currentHoverBuildingId = null;
      if (buildingHoverTimer) {
        clearTimeout(buildingHoverTimer);
        buildingHoverTimer = null;
      }
    };

    window.addEventListener('konvaDragHoverBuilding', handleHoverBuilding);
    window.addEventListener('konvaDragHoverBuildingEnd', handleHoverBuildingEnd);

    return () => {
      window.removeEventListener('konvaDragHoverBuilding', handleHoverBuilding);
      window.removeEventListener('konvaDragHoverBuildingEnd', handleHoverBuildingEnd);
      if (buildingHoverTimer) clearTimeout(buildingHoverTimer);
    };
  }, [currentBuilding, onSelectBuilding]);
  // Removed automatic expansion on currentBuilding change so buildings remain collapsed by default

  const categoryCounts = {};
  equipments.forEach(eq => {
    const cid = eq.category_id || eq.category?.id;
    if (cid) {
      categoryCounts[cid] = (categoryCounts[cid] || 0) + 1;
    }
  });

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside 
      className="left-sidebar"
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
      <div className="neu-raised" style={{ padding: '16px', flex: '1', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Input 
            placeholder="Cari kategori..." 
            style={{ paddingLeft: '40px' }} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '20px', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
        </div>

        {/* Area & Floor Accordion */}
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Area & Lantai</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', paddingBottom: '4px' }}>
            {buildings.map(bldg => {
              const isExpanded = expandedBuildingIds.includes(bldg.id);
              
              return (
                <div key={bldg.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Area Header (Accordion Button) */}
                <button 
                  data-building-id={bldg.id}
                  onClick={() => {
                    setExpandedBuildingIds(prev => 
                      prev.includes(bldg.id) 
                        ? prev.filter(id => id !== bldg.id)
                        : [...prev, bldg.id]
                    );
                    if (!isExpanded && currentBuilding?.id !== bldg.id) {
                      onSelectBuilding(bldg.id);
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('konvaDragHoverBuilding', { detail: bldg.id }));
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('konvaDragHoverBuildingEnd'));
                  }}
                  className={isExpanded ? "neu-inset" : "neu-raised-sm"} 
                  style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    color: isExpanded ? 'var(--color-primary)' : 'var(--color-text-primary)', 
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
                  {isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '16px', marginTop: '2px' }}>
                      {(buildingFloors[bldg.id] || []).map(floor => {
                        const isActive = currentFloor?.id === floor.id;
                        return (
                          <button 
                            key={floor.id}
                            data-floor-id={floor.id}
                            onClick={() => onSelectFloor(floor)}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              window.dispatchEvent(new CustomEvent('konvaDragHoverFloor', { detail: floor.id }));
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              window.dispatchEvent(new CustomEvent('konvaDragHoverFloorEnd'));
                            }}
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
                      {(buildingFloors[bldg.id] || []).length === 0 && (
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

        {/* Categories Filter List */}
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Kategori Barang</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', paddingBottom: '4px' }}>
            
            <button 
              onClick={() => onSelectCategory(null)}
              className={selectedCategoryIds.length === 0 ? "neu-inset" : "neu-raised-sm"} 
              style={{ 
                padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', border: 'none', background: 'transparent', borderRadius: '12px',
                color: selectedCategoryIds.length === 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: selectedCategoryIds.length === 0 ? '600' : '500'
              }}
            >
              <span>Semua Barang</span>
              <span className="neu-raised-sm" style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '8px' }}>{equipments.length}</span>
            </button>

            {filteredCategories.map(cat => {
              const count = categoryCounts[cat.id] || 0;
              const isActive = selectedCategoryIds.includes(cat.id);
              
              return (
                <button 
                  key={cat.id} 
                  onClick={() => onSelectCategory(cat.id)} 
                  className={isActive ? "neu-inset" : "neu-raised-sm"} 
                  style={{ 
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                    cursor: 'pointer', border: 'none', background: 'transparent', borderRadius: '12px',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)'
                  }}
                >
                  <div style={{ 
                    width: '28px', height: '28px', borderRadius: '50%', 
                    background: `${cat.color || '#3b82f6'}20`, 
                    color: cat.color || '#3b82f6', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontWeight: 'bold', fontSize: '0.8rem'
                  }}>
                    {cat.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                    <p style={{ margin: 0, fontWeight: isActive ? '700' : '600', fontSize: '0.875rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{cat.name}</p>
                  </div>
                  <span className="neu-raised-sm" style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '8px', color: 'var(--color-text-secondary)' }}>
                    {count}
                  </span>
                </button>
              );
            })}
            
            {filteredCategories.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '16px' }}>Tidak ada kategori</p>
            )}
          </div>
        </div>
        
      </div>
    </aside>
  );
};

export default LeftSidebar;
