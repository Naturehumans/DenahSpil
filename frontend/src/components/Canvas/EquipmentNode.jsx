import React, { useRef, useEffect } from 'react';
import { Group, Circle, Text } from 'react-konva';

const EquipmentNode = ({
  equipment,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
  isDraggable = true,
  scale = 1
}) => {
  const groupRef = useRef();
  const isDraggingRef = useRef(false);

  // Adjust node scale inversely to canvas scale to keep icons the same visual size
  const invertedScale = 1 / scale;

  // Determine colors based on status
  let bgColor = '#db2777'; // Default primary

  if (equipment.status === 'active') bgColor = '#22c55e'; // success
  if (equipment.status === 'warning') bgColor = '#f59e0b'; // warning
  if (equipment.status === 'expired') bgColor = '#cf2821'; // danger
  if (equipment.status === 'replaced') bgColor = '#636e72'; // secondary

  // If a category overrides color
  if (equipment.category && equipment.category.color) {
    bgColor = equipment.category.color;
  }

  let strokeColor = 'white';
  if (equipment.status === 'expired') strokeColor = '#cf2821';
  if (equipment.status === 'warning') strokeColor = '#f59e0b';

  // Get first letter of category as icon placeholder if no icon_url
  const iconText = equipment.category ? equipment.category.name.charAt(0).toUpperCase() : '?';

  return (
    <Group
      x={equipment.position_x}
      y={equipment.position_y}
      draggable={isDraggable}
      onDragStart={(e) => {
        e.cancelBubble = true;
        isDraggingRef.current = true;
        if (onDragStart) onDragStart(equipment);
      }}
      onDragMove={(e) => {
        if (e.evt) {
          const elem = document.elementFromPoint(e.evt.clientX, e.evt.clientY);
          const hoverFloorId = elem ? elem.getAttribute('data-floor-id') : null;
          const hoverBuildingId = elem ? elem.getAttribute('data-building-id') : null;
          
          if (hoverFloorId) {
            window.dispatchEvent(new CustomEvent('konvaDragHoverFloor', { detail: hoverFloorId }));
          } else if (hoverBuildingId) {
            window.dispatchEvent(new CustomEvent('konvaDragHoverBuilding', { detail: hoverBuildingId }));
          } else {
            window.dispatchEvent(new CustomEvent('konvaDragHoverFloorEnd'));
            window.dispatchEvent(new CustomEvent('konvaDragHoverBuildingEnd'));
          }
        }
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        window.dispatchEvent(new CustomEvent('konvaDragHoverFloorEnd'));
        onDragEnd(equipment.id, e.target.x(), e.target.y());
        setTimeout(() => { isDraggingRef.current = false; }, 150);
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        if (isDraggingRef.current) return;
        onSelect(equipment);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        if (isDraggingRef.current) return;
        onSelect(equipment);
      }}
      ref={groupRef}
      scaleX={invertedScale}
      scaleY={invertedScale}
    >
      {isSelected && (
        <Circle
          radius={18}
          fill="transparent"
          stroke="#db2777"
          strokeWidth={2}
          dash={[4, 4]}
        />
      )}

      <Circle
        radius={14}
        fill={bgColor}
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 2}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />

      <Text
        text={iconText}
        fontSize={14}
        fontFamily="Inter"
        fontStyle="bold"
        fill="white"
        align="center"
        verticalAlign="middle"
        width={28}
        height={28}
        offsetX={14}
        offsetY={14}
      />
      
      {/* Kondisi Status Indicator */}
      {equipment.status === 'warning' && (
        <Circle radius={5} fill="#f59e0b" stroke="white" strokeWidth={1} offsetX={-10} offsetY={10} />
      )}
      {equipment.status === 'damaged' && (
        <Circle radius={5} fill="#ef4444" stroke="white" strokeWidth={1} offsetX={-10} offsetY={10} />
      )}
    </Group>
  );
};

export default EquipmentNode;
