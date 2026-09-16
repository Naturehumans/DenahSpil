import React from 'react';
import { ZoomIn, ZoomOut, Maximize, Printer, Download, ClipboardList } from 'lucide-react';

const CanvasControls = ({ 
  onZoomIn, onZoomOut, onResetZoom, onPrint, onExport,
  isEditMode, showGrid, onToggleGrid,
  gridSizeMultiplier, onGridSizeChange, onGridOffsetChange
}) => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '120px',
      right: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 10
    }}>
      <div className="neu-raised" style={{ display: 'flex', flexDirection: 'column', padding: '4px', borderRadius: '12px' }}>
        <button 
          onClick={onZoomIn}
          className="neu-action-btn"
          style={{
            padding: '12px',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '4px'
          }}
          title="Zoom In"
        >
          <ZoomIn size={20} />
        </button>
        <button 
          onClick={onResetZoom}
          className="neu-action-btn"
          style={{
            padding: '12px',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '4px'
          }}
          title="Reset View"
        >
          <Maximize size={20} />
        </button>
        <button 
          onClick={onZoomOut}
          className="neu-action-btn"
          style={{
            padding: '12px',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Zoom Out"
        >
          <ZoomOut size={20} />
        </button>
      </div>

      {isEditMode && (
        <div style={{ position: 'relative' }}>
          {showGrid && (
            <div className="neu-raised" style={{
              position: 'absolute',
              right: '60px',
              bottom: '0',
              padding: '12px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              width: 'max-content',
              background: 'var(--color-bg)'
            }}>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Pengaturan Grid</p>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Ukuran:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => onGridSizeChange(1)} className={gridSizeMultiplier === 1 ? 'neu-inset' : 'neu-raised-sm'} style={{ border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', color: gridSizeMultiplier === 1 ? 'var(--color-primary)' : 'inherit' }}>1.0</button>
                  <button onClick={() => onGridSizeChange(0.75)} className={gridSizeMultiplier === 0.75 ? 'neu-inset' : 'neu-raised-sm'} style={{ border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', color: gridSizeMultiplier === 0.75 ? 'var(--color-primary)' : 'inherit' }}>0.75</button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Geser Y:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => onGridOffsetChange(0, -5)} className="neu-raised-sm" style={{ border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>▲</button>
                  <button onClick={() => onGridOffsetChange(0, 5)} className="neu-raised-sm" style={{ border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>▼</button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Geser X:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => onGridOffsetChange(-5, 0)} className="neu-raised-sm" style={{ border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>◀</button>
                  <button onClick={() => onGridOffsetChange(5, 0)} className="neu-raised-sm" style={{ border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>▶</button>
                </div>
              </div>
            </div>
          )}

          <button 
            onClick={onToggleGrid}
            className="neu-raised neu-action-btn"
            style={{
              padding: '12px',
              color: showGrid ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: showGrid ? 'rgba(58, 149, 66, 0.1)' : 'var(--color-bg)',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
            title="Toggle Grid & Snap"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
              <line x1="9" y1="3" x2="9" y2="21"></line>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          </button>
        </div>
      )}

      <button 
        className="neu-raised neu-action-btn"
        onClick={onExport}
        style={{
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          border: 'none',
          padding: '14px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '8px'
        }}
        title="Export Data ke Excel/CSV"
      >
        <Download size={20} color="#0284c7" />
      </button>

      <button 
        className="neu-raised neu-raised-btn"
        onClick={onPrint}
        style={{
          background: 'var(--color-primary)',
          color: 'white',
          border: 'none',
          padding: '16px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '4px'
        }}
        title="Print Floor Plan"
      >
        <Printer size={20} />
      </button>

      <button 
        className="neu-raised neu-action-btn"
        onClick={() => window.dispatchEvent(new CustomEvent('toggle-right-sidebar'))}
        style={{
          background: 'var(--color-bg)',
          color: 'var(--color-primary)',
          border: 'none',
          padding: '14px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '4px'
        }}
        title="Daftar Barang"
      >
        <ClipboardList size={20} />
      </button>
    </div>
  );
};

export default CanvasControls;
