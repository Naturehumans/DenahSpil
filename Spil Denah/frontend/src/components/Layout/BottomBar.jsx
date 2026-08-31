import React, { useState } from 'react';
import { Layers, Grid, Edit3, Clock, ChevronUp, ChevronDown, Box } from 'lucide-react';
import Button from '../UI/Button';

const BottomBar = ({ isEditMode = false, onManageFloors, onManageCategories, onManageEquipments, onManageInventory, onManageHistory }) => {
  const [isVisible, setIsVisible] = useState(true);

  return (
    <div style={{
      position: 'absolute',
      bottom: isVisible ? '24px' : '-80px',
      left: '50%',
      transform: 'translateX(-50%)',
      transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      zIndex: 45,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px'
    }}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="neu-raised"
        style={{
          background: 'var(--color-bg)',
          border: 'none',
          width: '40px',
          height: '24px',
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          position: 'absolute',
          top: '-24px'
        }}
        title={isVisible ? "Sembunyikan Menu" : "Tampilkan Menu"}
      >
        {isVisible ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {/* Main Bar */}
      <div className="neu-raised" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 24px',
        gap: '24px',
        borderRadius: '50px',
        background: 'rgba(250, 250, 250, 0.8)',
        backdropFilter: 'blur(8px)',
      }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button 
            className="neu-action-btn"
            onClick={onManageFloors} 
            style={{ 
              width: '48px', height: '48px', padding: 0, 
              borderRadius: '50%', background: 'transparent', 
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
            <Layers size={20} color="#db2777" />
          </button>
          <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Area</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button 
            className="neu-action-btn"
            onClick={onManageEquipments} 
            style={{ 
              width: '48px', height: '48px', padding: 0, 
              borderRadius: '50%', border: 'none',
              background: isEditMode ? 'var(--color-success)' : 'transparent', 
              boxShadow: isEditMode ? '0 0 15px rgba(34, 197, 94, 0.4)' : undefined, 
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
            <Edit3 size={20} color={isEditMode ? '#ffffff' : '#10b981'} />
          </button>
          <span style={{ fontSize: '0.7rem', fontWeight: '600', color: isEditMode ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
            {isEditMode ? 'Edit Mode' : 'Barang'}
          </span>
        </div>


        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button 
            className="neu-action-btn"
            onClick={onManageInventory} 
            style={{ 
              width: '48px', height: '48px', padding: 0, 
              borderRadius: '50%', background: 'transparent', 
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
            <Box size={20} color="#8b5cf6" />
          </button>
          <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Inventori</span>
        </div>

        <div style={{ width: '2px', height: '32px', background: 'var(--color-text-muted)', opacity: 0.3, borderRadius: '2px' }}></div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button 
            className="neu-action-btn"
            onClick={onManageHistory} 
            style={{ 
              width: '48px', height: '48px', padding: 0, 
              borderRadius: '50%', background: 'transparent', 
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
            <Clock size={20} color="#0284c7" />
          </button>
          <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>History</span>
        </div>

      </div>
    </div>
  );
};

export default BottomBar;
