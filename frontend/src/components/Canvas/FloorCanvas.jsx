import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Text, Group } from 'react-konva';
import useImage from 'use-image';
import CanvasControls from './CanvasControls';
import EquipmentNode from './EquipmentNode';
import SlotNode from './SlotNode';
import { getPolygonCentroid } from '../../utils/geometry';

const FloorCanvas = ({ 
  imageUrl, 
  equipments = [], 
  onEquipmentClick, 
  onEquipmentMove,
  isEditMode = false,
  selectedEquipmentId = null,
  highlightedSlotId = null,
  slots = [],
  onSlotDrop,
  onItemDropOnSlot,
  onSlotMove,
  onSlotSelect,
  onExport,
  activeMobileSlotTemplate = null,
  onCancelMobilePlacement = null,
  onCanvasClick,
  roomPolygons = [],
  isDrawingPolygon = false,
  onPolygonComplete,
  onPolygonDelete,
  currentPolygon = [],
  setCurrentPolygon,
  onPolygonClick
}) => {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [image] = useImage(imageUrl);
  
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stageState, setStageState] = useState({
    scale: 1,
    x: 0,
    y: 0
  });
  const [selectedId, setSelectedId] = useState(selectedEquipmentId);
  const [showGrid, setShowGrid] = useState(false);
  const crossFloorDraggedItemRef = useRef(null);

  // Preserve dragged items across floor changes
  const combinedSlots = React.useMemo(() => {
    const all = [...slots];
    if (crossFloorDraggedItemRef.current && crossFloorDraggedItemRef.current.type === 'slot') {
      if (!all.find(s => s.id === crossFloorDraggedItemRef.current.item.id)) {
        all.push({ ...crossFloorDraggedItemRef.current.item, _isGhost: true });
      }
    }
    return all;
  }, [slots]);

  const combinedEquipments = React.useMemo(() => {
    const all = [...equipments];
    if (crossFloorDraggedItemRef.current && crossFloorDraggedItemRef.current.type === 'equipment') {
      if (!all.find(e => e.id === crossFloorDraggedItemRef.current.item.id)) {
        all.push({ ...crossFloorDraggedItemRef.current.item, _isGhost: true });
      }
    }
    return all;
  }, [equipments]);
  const [gridSizeMultiplier, setGridSizeMultiplier] = useState(1);
  const [gridOffset, setGridOffset] = useState({ x: 0, y: 0 });
  const [isTwoFingerTouch, setIsTwoFingerTouch] = useState(false);

  // Touch gesture state refs (using refs to avoid stale closures in event handlers)
  const lastTouchDistRef = useRef(null);
  const lastTouchCenterRef = useRef(null);
  const stageStateRef = useRef(stageState);
  useEffect(() => {
    stageStateRef.current = stageState;
  }, [stageState]);


  // Sync prop changes
  useEffect(() => {
    if (selectedEquipmentId !== undefined) {
      setSelectedId(selectedEquipmentId);
    }
  }, [selectedEquipmentId]);

  // Disable grid if we exit edit mode
  useEffect(() => {
    if (!isEditMode) {
      setShowGrid(false);
    }
  }, [isEditMode]);

  // Clear polygon if drawing mode exits
  useEffect(() => {
    if (!isDrawingPolygon) {
      setCurrentPolygon([]);
    }
  }, [isDrawingPolygon]);

  // Window resize observer to update canvas dimensions safely
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const newWidth = containerRef.current.offsetWidth;
        const newHeight = containerRef.current.offsetHeight;
        setDimensions(prev => {
          if (prev.width === newWidth && prev.height === newHeight) return prev;
          return { width: newWidth, height: newHeight };
        });
      }
    };
    
    // Initial size
    updateSize();
    
    // Slight delay to ensure layout is done
    const timeout = setTimeout(updateSize, 100);
    
    window.addEventListener('resize', updateSize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // ─── Touch Gesture Handlers (Pinch to Zoom + Single-Finger Pan) ────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getDistance = (t1, t2) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getMidpoint = (t1, t2, rect) => ({
      x: ((t1.clientX + t2.clientX) / 2) - rect.left,
      y: ((t1.clientY + t2.clientY) / 2) - rect.top,
    });

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        setIsTwoFingerTouch(true);
        lastTouchDistRef.current = getDistance(e.touches[0], e.touches[1]);
        const rect = el.getBoundingClientRect();
        lastTouchCenterRef.current = getMidpoint(e.touches[0], e.touches[1], rect);
      } else if (e.touches.length === 1) {
        setIsTwoFingerTouch(false);
        lastTouchCenterRef.current = {
          x: e.touches[0].clientX - el.getBoundingClientRect().left,
          y: e.touches[0].clientY - el.getBoundingClientRect().top,
        };
        lastTouchDistRef.current = null;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 2) {
        // ─ Pinch Zoom ─
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const newDist = getDistance(e.touches[0], e.touches[1]);
        const newCenter = getMidpoint(e.touches[0], e.touches[1], rect);

        if (lastTouchDistRef.current !== null) {
          const ratio = newDist / lastTouchDistRef.current;
          const current = stageStateRef.current;
          const oldScale = current.scale;
          let newScale = oldScale * ratio;
          newScale = Math.max(0.1, Math.min(10, newScale));

          // Zoom toward pinch center
          const cx = newCenter.x;
          const cy = newCenter.y;
          const originX = (cx - current.x) / oldScale;
          const originY = (cy - current.y) / oldScale;

          // Also account for finger-pair panning
          const panDx = newCenter.x - lastTouchCenterRef.current.x;
          const panDy = newCenter.y - lastTouchCenterRef.current.y;

          setStageState({
            scale: newScale,
            x: cx - originX * newScale + panDx,
            y: cy - originY * newScale + panDy,
          });
        }

        lastTouchDistRef.current = newDist;
        lastTouchCenterRef.current = newCenter;

      } else if (e.touches.length === 1 && lastTouchDistRef.current === null) {
        // ─ Single-finger pan (only when NOT pinching) ─
        // We let Konva's built-in draggable handle this
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        lastTouchDistRef.current = null;
        setIsTwoFingerTouch(false);
        if (e.touches.length === 1) {
          const rect = el.getBoundingClientRect();
          lastTouchCenterRef.current = {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top,
          };
        }
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []); // empty deps — reads stageState via ref


  // Fit image to screen initially
  useEffect(() => {
    if (image && dimensions.width > 0) {
      const scale = Math.min(
        dimensions.width / image.width,
        dimensions.height / image.height
      ) * 0.9; // 90% of container to leave margin
      
      setStageState({
        scale,
        x: (dimensions.width - image.width * scale) / 2,
        y: (dimensions.height - image.height * scale) / 2
      });
    }
  }, [image, dimensions]);

  // Handle zooming via mouse wheel
  const handleWheel = (e) => {
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // Limit zoom
    if (newScale < 0.1 || newScale > 10) return;

    setStageState({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleZoomIn = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const newScale = oldScale * 1.2;
    if (newScale > 10) return;
    
    setStageState(prev => ({
      ...prev,
      scale: newScale,
      // Adjust position to center zoom roughly
      x: prev.x - (dimensions.width / 2) * 0.2 * oldScale,
      y: prev.y - (dimensions.height / 2) * 0.2 * oldScale,
    }));
  };

  const handleZoomOut = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const newScale = oldScale / 1.2;
    if (newScale < 0.1) return;
    
    setStageState(prev => ({
      ...prev,
      scale: newScale,
      x: prev.x + (dimensions.width / 2) * 0.2 * newScale,
      y: prev.y + (dimensions.height / 2) * 0.2 * newScale,
    }));
  };

  const handleResetZoom = () => {
    if (image) {
      const scale = Math.min(
        dimensions.width / image.width,
        dimensions.height / image.height
      ) * 0.9;
      
      setStageState({
        scale,
        x: (dimensions.width - image.width * scale) / 2,
        y: (dimensions.height - image.height * scale) / 2
      });
    }
  };

  const handlePrint = () => {
    if (!stageRef.current) return;
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
    
    // Calculate Summary and Table Rows
    const totalSlots = slots.length;
    let installedSlots = 0;
    let uninstalledSlots = 0;

    const tableRows = slots.map(slot => {
      const isInstalled = !!slot.equipment;
      if (isInstalled) installedSlots++;
      else uninstalledSlots++;
      
      const idTempat = slot.slot_code || slot.id;
      const kategori = slot.category?.name || '-';
      const idBarang = slot.equipment?.asset_id || '-';
      const merkType = isInstalled 
        ? `${slot.equipment.brand || ''} ${slot.equipment.model_number || ''}`.trim() || '-'
        : '-';
      let kondisi = isInstalled ? (slot.equipment.status || 'Aktif') : 'Belum Terpasang (Kosong)';
      
      if (kondisi.toLowerCase() === 'available' || kondisi.toLowerCase() === 'aktif') kondisi = 'Siap Pakai / Aktif';
      else if (kondisi.toLowerCase() === 'damaged') kondisi = 'Perlu Cek / Rusak';

      const lokasi = slot.room_name || slot.location_info || '-';

      return `
        <tr>
          <td>${idTempat}</td>
          <td>${kategori}</td>
          <td>${lokasi}</td>
          <td>${idBarang}</td>
          <td>${merkType}</td>
          <td style="color: ${isInstalled ? 'inherit' : '#dc2626'}; font-weight: ${isInstalled ? 'normal' : 'bold'}">${kondisi}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Print Denah</title>
          <style>
            * { box-sizing: border-box; }
            body { 
              margin: 0; 
              padding: 0;
              font-family: 'Segoe UI', Arial, sans-serif;
              color: #1e293b;
            }

            /* ── Section 1: Denah Image (Landscape) ── */
            .image-section {
              width: 100%;
              padding: 8px;
              page: landscape-page;
              break-after: page;
            }
            .image-section img { 
              width: 100%;
              height: auto;
              display: block;
              object-fit: contain;
            }

            /* ── Section 2: Data Table (Portrait) ── */
            .details-page {
              padding: 16px;
              page: portrait-page;
            }
            h2 { border-bottom: 2px solid #3a9542; padding-bottom: 10px; color: #0f172a; margin-top: 0; font-size: 16px; }
            .summary {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              margin-bottom: 20px;
            }
            .summary-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 12px 14px;
              border-radius: 8px;
              flex: 1 1 80px;
              text-align: center;
            }
            .summary-box h3 { margin: 0 0 4px; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
            .summary-box p { margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 7px 8px;
              text-align: left;
            }
            th {
              background: #3a9542;
              color: white;
              font-weight: 600;
            }
            tr:nth-child(even) { background-color: #f8fafc; }

            @media print {
              /* Named page for the denah image → Landscape */
              @page landscape-page {
                size: landscape;
                margin: 6mm;
              }
              /* Named page for the data table → Portrait */
              @page portrait-page {
                size: portrait;
                margin: 10mm;
              }
              body { margin: 0; }
              .image-section { padding: 0; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              thead { display: table-header-group; }
            }
          </style>
        </head>
        <body>
          <div class="image-section">
            <img src="${dataUrl}" />
          </div>
          <div class="details-page">
            <h2>Ringkasan Denah &amp; Detail Barang</h2>
            <div class="summary">
              <div class="summary-box">
                <h3>Total Titik</h3>
                <p>${totalSlots}</p>
              </div>
              <div class="summary-box" style="border-color: #bbf7d0; background: #f0fdf4;">
                <h3 style="color: #166534;">Terpasang</h3>
                <p style="color: #15803d;">${installedSlots}</p>
              </div>
              <div class="summary-box" style="border-color: #fecaca; background: #fef2f2;">
                <h3 style="color: #991b1b;">Kosong</h3>
                <p style="color: #dc2626;">${uninstalledSlots}</p>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID Tempat</th>
                  <th>Kategori</th>
                  <th>Lokasi Ruang</th>
                  <th>ID Barang</th>
                  <th>Merk &amp; Tipe</th>
                  <th>Kondisi</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
          <script>window.onload = function() { window.print(); };<\/script>
        </body>
      </html>
    `;

    // Remove any existing print iframe
    const existing = document.getElementById('spil-print-frame');
    if (existing) existing.remove();

    // Create a hidden iframe in the current page
    const iframe = document.createElement('iframe');
    iframe.id = 'spil-print-frame';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:100%;height:100%;border:none;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Clean up iframe after printing is dismissed
    iframe.contentWindow.addEventListener('afterprint', () => {
      iframe.remove();
    });
  };

  const handleStageClick = (e) => {
    // Only allow left click (0) or touch events (where button is undefined)
    if (e.evt && e.evt.button !== undefined && e.evt.button !== 0) return;

    const stage = e.target.getStage();
    const pointerPosition = stage ? stage.getPointerPosition() : null;

    if (pointerPosition && activeMobileSlotTemplate && isEditMode) {
      const x = (pointerPosition.x - stageState.x) / stageState.scale;
      const y = (pointerPosition.y - stageState.y) / stageState.scale;
      
      if (onSlotDrop) {
        onSlotDrop(activeMobileSlotTemplate.id, x, y);
      }
      if (onCancelMobilePlacement) {
        onCancelMobilePlacement();
      }
      return;
    }

    if (isDrawingPolygon && isEditMode) {
      if (pointerPosition) {
        const x = (pointerPosition.x - stageState.x) / stageState.scale;
        const y = (pointerPosition.y - stageState.y) / stageState.scale;
        
        // If it's a double click or we click near the first point, complete polygon
        // But double click event is handled separately. Let's just add point for single click.
        setCurrentPolygon(prev => [...prev, { x, y }]);
      }
      return;
    }

    // If clicked on empty area, deselect or trigger canvas click
    if (e.target === e.target.getStage() || e.target.attrs.id === 'bg-image' || e.target.attrs.id === 'grid-layer') {
      setSelectedId(null);
      
      if (pointerPosition) {
        const x = (pointerPosition.x - stageState.x) / stageState.scale;
        const y = (pointerPosition.y - stageState.y) / stageState.scale;
        
        if (onCanvasClick && isEditMode) {
          onCanvasClick({ x, y });
        }
      }
    }
  };

  // Generate grid lines
  const baseGridSize = 40;
  const currentGridSize = baseGridSize * gridSizeMultiplier;
  const gridLines = [];
  
  if (showGrid && isEditMode && image) {
    const numVertical = Math.ceil(image.width / currentGridSize) + 1;
    const numHorizontal = Math.ceil(image.height / currentGridSize) + 1;
    const strokeWidth = 1 / stageState.scale; // keep line thickness constant

    const offsetX = gridOffset.x % currentGridSize;
    const offsetY = gridOffset.y % currentGridSize;

    for (let i = -1; i <= numVertical; i++) {
      const x = i * currentGridSize + offsetX;
      if (x >= 0 && x <= image.width) {
        gridLines.push(
          <Line 
            key={`v-${i}`} 
            points={[x, 0, x, image.height]} 
            stroke="rgba(0,0,0,0.3)" 
            strokeWidth={strokeWidth} 
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      }
    }
    for (let j = -1; j <= numHorizontal; j++) {
      const y = j * currentGridSize + offsetY;
      if (y >= 0 && y <= image.height) {
        gridLines.push(
          <Line 
            key={`h-${j}`} 
            points={[0, y, image.width, y]} 
            stroke="rgba(0,0,0,0.3)" 
            strokeWidth={strokeWidth} 
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      }
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!isEditMode) return;
    
    try {
      if (stageRef.current) {
        stageRef.current.setPointersPositions(e);
      }
    } catch (err) {
      console.warn('Konva setPointersPositions error:', err);
    }
    
    let pos = stageRef.current ? stageRef.current.getPointerPosition() : null;
    if (!pos && e.nativeEvent) {
       pos = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    }
    if (!pos) {
       pos = { x: 400, y: 300 }; // safe fallback
    }

    const x = (pos.x - stageState.x) / stageState.scale;
    const y = (pos.y - stageState.y) / stageState.scale;
    
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      
      const data = JSON.parse(dataStr);
      
      if (data.type === 'slot-template' && onSlotDrop) {
        onSlotDrop(data.categoryId, x, y);
      } else if (data.type === 'stock-item' && onItemDropOnSlot) {
        // Find nearest slot
        const nearestSlot = slots.find(s => {
          const dx = s.position_x - x;
          const dy = s.position_y - y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          return dist < 30; // 30px radius threshold
        });
        
        if (nearestSlot) {
          onItemDropOnSlot(data.categoryId, nearestSlot.id);
        } else {
          if (onItemDropOnSlot) onItemDropOnSlot(data.categoryId, null);
        }
      }
    } catch (err) {
      console.error('Error during drop:', err);
    }
  };

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDrop={handleDrop}
    >
      {/* Active Mobile Slot Placement Banner */}
      {activeMobileSlotTemplate && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'var(--color-primary, #3a9542)',
          color: 'white',
          padding: '10px 18px',
          borderRadius: '24px',
          boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.85rem',
          fontWeight: '700',
          maxWidth: '90%',
          pointerEvents: 'auto'
        }}>
          <span>📌 Mode Slot ({activeMobileSlotTemplate.name}): Ketuk lokasi pada denah</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onCancelMobilePlacement) onCancelMobilePlacement();
            }}
            style={{
              background: 'rgba(255,255,255,0.25)',
              border: 'none',
              color: 'white',
              borderRadius: '50%',
              width: '22px',
              height: '22px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="Batal"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Background pattern for canvas to look nice */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'radial-gradient(var(--color-text-muted) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        opacity: 0.2,
        pointerEvents: 'none'
      }} />

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onWheel={handleWheel}
        draggable={!activeMobileSlotTemplate && !isTwoFingerTouch} // Disable Konva drag when pinching with 2 fingers
        x={stageState.x}
        y={stageState.y}
        scaleX={stageState.scale}
        scaleY={stageState.scale}
        ref={stageRef}
        onDragEnd={(e) => {
          // Update state after panning
          if (e.target === e.target.getStage()) {
            setStageState(prev => ({
              ...prev,
              x: e.target.x(),
              y: e.target.y()
            }));
          }
        }}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer>
          {/* Main Background Image */}
          {image && (
            <KonvaImage
              id="bg-image"
              image={image}
              width={image.width}
              height={image.height}
            />
          )}

          {/* Grid Overlay */}
          {gridLines}

          {/* Render Saved Polygons */}
          {roomPolygons.map((polygon, index) => {
            const points = polygon.coordinates.flatMap(p => [p.x, p.y]);
            const centroid = getPolygonCentroid(polygon.coordinates);
            
            const POLYGON_COLORS = [
              { stroke: "rgba(58, 149, 66, 0.8)", fill: "rgba(58, 149, 66, 0.15)" }, // Green
              { stroke: "rgba(37, 99, 235, 0.8)", fill: "rgba(37, 99, 235, 0.15)" }, // Blue
              { stroke: "rgba(220, 38, 38, 0.8)", fill: "rgba(220, 38, 38, 0.15)" }, // Red
              { stroke: "rgba(217, 119, 6, 0.8)", fill: "rgba(217, 119, 6, 0.15)" }, // Orange
              { stroke: "rgba(147, 51, 234, 0.8)", fill: "rgba(147, 51, 234, 0.15)" }, // Purple
              { stroke: "rgba(13, 148, 136, 0.8)", fill: "rgba(13, 148, 136, 0.15)" }, // Teal
              { stroke: "rgba(236, 72, 153, 0.8)", fill: "rgba(236, 72, 153, 0.15)" }, // Pink
            ];
            const colorTheme = POLYGON_COLORS[index % POLYGON_COLORS.length];

            return (
              <Group key={polygon.id}>
                <Line
                  points={points}
                  closed={true}
                  stroke={colorTheme.stroke}
                  strokeWidth={2 / stageState.scale}
                  fill={colorTheme.fill}
                  onClick={(e) => {
                    if (onPolygonClick) {
                      e.cancelBubble = true;
                      onPolygonClick(polygon);
                    }
                  }}
                  onTap={(e) => {
                    if (onPolygonClick) {
                      e.cancelBubble = true;
                      onPolygonClick(polygon);
                    }
                  }}
                />
                {centroid.x !== 0 && centroid.y !== 0 && (
                  <Text
                    x={centroid.x}
                    y={centroid.y}
                    text={polygon.name}
                    fontSize={14 / stageState.scale}
                    fontFamily="Inter, sans-serif"
                    fill="rgba(0, 0, 0, 0.6)"
                    align="center"
                    verticalAlign="middle"
                    offsetX={50} // Approximate center
                    offsetY={7}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

          {/* Render Currently Drawing Polygon */}
          {currentPolygon.length > 0 && (
            <Group>
              <Line
                points={currentPolygon.flatMap(p => [p.x, p.y])}
                closed={currentPolygon.length >= 3}
                stroke="rgba(37, 99, 235, 0.8)"
                strokeWidth={2 / stageState.scale}
                dash={[10 / stageState.scale, 5 / stageState.scale]}
                fill={currentPolygon.length >= 3 ? "rgba(37, 99, 235, 0.2)" : null}
              />
              {currentPolygon.map((p, i) => (
                <Circle
                  key={i}
                  x={p.x}
                  y={p.y}
                  radius={5 / stageState.scale}
                  fill="rgba(37, 99, 235, 1)"
                  listening={false}
                />
              ))}
            </Group>
          )}

          {/* Slots */}
          {combinedSlots.map((slot) => (
            <SlotNode
              key={slot.id}
              slot={slot}
              isSelected={selectedId === (slot.equipment_id || slot.id)}
              isHighlighted={highlightedSlotId === slot.id}
              onSelect={(eq) => {
                const id = eq ? eq.id : slot.id;
                setSelectedId(id);
                if (onSlotSelect) onSlotSelect(slot, eq);
              }}
              onDragStart={(slot) => {
                crossFloorDraggedItemRef.current = { type: 'slot', item: slot };
              }}
              onDragEnd={(id, x, y, isFilled = false) => {
                const draggedItem = crossFloorDraggedItemRef.current;
                crossFloorDraggedItemRef.current = null;
                if (onSlotMove && isEditMode) {
                  if (showGrid && !isFilled) {
                    const snapX = Math.round((x - gridOffset.x) / currentGridSize) * currentGridSize + gridOffset.x;
                    const snapY = Math.round((y - gridOffset.y) / currentGridSize) * currentGridSize + gridOffset.y;
                    onSlotMove(id, snapX, snapY, isFilled, draggedItem?.item);
                  } else {
                    onSlotMove(id, x, y, isFilled, draggedItem?.item);
                  }
                }
              }}
              isDraggable={isEditMode}
              scale={stageState.scale}
            />
          ))}

          {/* Equipments (legacy/non-slot ones) */}
          {combinedEquipments.filter(eq => !combinedSlots.some(s => s.equipment_id === eq.id)).map((eq) => (
            <EquipmentNode
              key={eq.id}
              equipment={eq}
              isSelected={selectedId === eq.id}
              onSelect={(eq) => {
                setSelectedId(eq.id);
                if (onEquipmentClick) onEquipmentClick(eq);
              }}
              onDragStart={(eq) => {
                crossFloorDraggedItemRef.current = { type: 'equipment', item: eq };
              }}
              onDragEnd={(id, x, y) => {
                crossFloorDraggedItemRef.current = null;
                if (onEquipmentMove && isEditMode) {
                  // Snap to grid if grid is active
                  if (showGrid) {
                    const snapX = Math.round((x - gridOffset.x) / currentGridSize) * currentGridSize + gridOffset.x;
                    const snapY = Math.round((y - gridOffset.y) / currentGridSize) * currentGridSize + gridOffset.y;
                    onEquipmentMove(id, snapX, snapY);
                  } else {
                    onEquipmentMove(id, x, y);
                  }
                }
              }}
              isDraggable={isEditMode}
              scale={stageState.scale}
            />
          ))}
        </Layer>
      </Stage>

      <CanvasControls 
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onPrint={handlePrint}
        onExport={onExport}
        isEditMode={isEditMode}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        gridSizeMultiplier={gridSizeMultiplier}
        onGridSizeChange={setGridSizeMultiplier}
        onGridOffsetChange={(dx, dy) => setGridOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))}
      />
    </div>
  );
};

export default FloorCanvas;
