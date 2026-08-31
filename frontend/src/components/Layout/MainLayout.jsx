import React, { useState } from 'react';
import Header from './Header';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import BottomBar from './BottomBar';
import EditLeftSidebar from './EditLeftSidebar';
import EditRightSidebar from './EditRightSidebar';

const MainLayout = ({ 
  children, 
  onManageFloors, 
  onManageCategories, 
  onManageEquipments, 
  onManageHistory,
  onManageInventory,
  onExport,
  buildings = [],
  currentBuilding,
  onSelectBuilding,
  floors = [],
  currentFloor,
  onSelectFloor,
  equipments = [],
  canvasEquipments = [],
  categories = [],
  onEquipmentClick,
  onEquipmentDoubleClick,
  highlightedSlotId = null,
  isEditMode = false,
  selectedCategoryId,
  onSelectCategory,
  slots = [],
  onDeleteSlot,
  onSelectMobileSlotTemplate
}) => {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  return (
    <div className="main-layout" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--color-bg)'
    }}>
      <Header 
        onMenuClick={() => {
          setLeftOpen(!leftOpen);
          if (!leftOpen) setRightOpen(false);
        }} 
        onAlertClick={() => {
          setRightOpen(!rightOpen);
          if (!rightOpen) setLeftOpen(false);
        }}
        alertsCount={0}
      />
      
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Left Sidebar */}
        <div className={`sidebar-container left ${leftOpen ? 'open' : ''}`}>
          {isEditMode ? (
            <EditLeftSidebar 
              isOpen={leftOpen} 
              onClose={() => setLeftOpen(false)} 
              categories={categories}
            />
          ) : (
            <LeftSidebar 
              isOpen={leftOpen} 
              onClose={() => setLeftOpen(false)} 
              buildings={buildings}
              currentBuilding={currentBuilding}
              onSelectBuilding={onSelectBuilding}
              floors={floors}
              currentFloor={currentFloor}
              onSelectFloor={onSelectFloor}
              equipments={equipments}
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={onSelectCategory}
            />
          )}
        </div>

        {/* Overlay for mobile left sidebar */}
        {leftOpen && (
          <div 
            className="sidebar-overlay"
            onClick={() => setLeftOpen(false)}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.2)',
              zIndex: 35
            }}
          />
        )}

        {/* Center Canvas Area */}
        <main style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '0 16px 16px 16px'
        }}>
          <div className="neu-inset" style={{
            flex: 1,
            borderRadius: '16px',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {children}
            {/* Overlay to ensure inset shadow is always visible over canvas/children */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              boxShadow: 'var(--neu-shadow-inset)',
              borderRadius: 'inherit',
              pointerEvents: 'none',
              zIndex: 20
            }} />
          </div>
        </main>

        <div className={`sidebar-container right ${rightOpen ? 'open' : ''}`}>
          {isEditMode ? (
            <EditRightSidebar 
              isOpen={rightOpen} 
              onClose={() => setRightOpen(false)} 
              categories={categories}
              slots={slots}
              onDeleteSlot={onDeleteSlot}
              onSelectMobileSlotTemplate={onSelectMobileSlotTemplate}
            />
          ) : (
            <RightSidebar 
              isOpen={rightOpen} 
              onClose={() => setRightOpen(false)} 
              equipments={canvasEquipments}
              onEquipmentClick={onEquipmentClick}
              onEquipmentDoubleClick={onEquipmentDoubleClick}
            />
          )}
        </div>

        {/* Overlay for mobile right sidebar */}
        {rightOpen && (
          <div 
            className="sidebar-overlay"
            onClick={() => setRightOpen(false)}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.2)',
              zIndex: 35
            }}
          />
        )}

        <BottomBar 
          isEditMode={isEditMode}
          onManageFloors={onManageFloors}
          onManageCategories={onManageCategories}
          onManageEquipments={onManageEquipments}
          onManageHistory={onManageHistory}
          onManageInventory={onManageInventory}
        />
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .sidebar-container {
          transition: transform 0.3s ease;
          z-index: 40;
          background: var(--color-bg);
        }
        
        @media (max-width: 1023px) {
          .sidebar-container.right {
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            transform: translateX(100%);
            box-shadow: -5px 0 15px rgba(0,0,0,0.05);
          }
          .sidebar-container.right.open {
            transform: translateX(0);
          }
        }

        @media (min-width: 1024px) {
          #alert-btn {
            display: none !important;
          }
        }

        @media (max-width: 767px) {
          #mobile-menu-btn {
            display: flex !important;
          }
          .sidebar-container.left {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            transform: translateX(-100%);
            box-shadow: 5px 0 15px rgba(0,0,0,0.05);
          }
          .sidebar-container.left.open {
            transform: translateX(0);
          }
          #user-info {
            display: none !important;
          }
        }

        @media (min-width: 768px) {
          #user-info {
            display: block !important;
          }
        }
      `}} />
    </div>
  );
};

export default MainLayout;
