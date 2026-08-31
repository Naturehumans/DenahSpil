import React, { useRef } from 'react';
import { Group, Circle, Text } from 'react-konva';

const HOLD_MS = 200;

const SlotNode = ({ 
  slot, 
  isSelected, 
  isHighlighted = false,
  onSelect, 
  onDragEnd, 
  isDraggable = true,
  scale = 1
}) => {
  const invertedScale = 1 / scale;
  const isFilled = slot.equipment_id != null;
  const color = slot.category?.color || '#3b82f6';
  const categoryLetter = slot.category?.name ? slot.category.name.charAt(0).toUpperCase() : '?';
  const slotLabel = slot.slot_code || slot.equipment?.slot_code;

  const isDraggingItemRef = useRef(false);
  const dragStartTimeRef = useRef(0);
  const origPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const templateGroupRef = useRef(null);

  if (isFilled && slot.equipment) {
    const bgColor = color;
    const eqLabel = slotLabel || slot.equipment.name || '?';

    return (
      <>
        {/* Static template circle — always stays in place, never moves */}
        <Group
          ref={templateGroupRef}
          x={slot.position_x}
          y={slot.position_y}
          scaleX={invertedScale}
          scaleY={invertedScale}
          listening={false}
          opacity={0.3}
        >
          <Circle
            radius={21}
            fill="transparent"
            stroke={color}
            strokeWidth={2}
            dash={[5, 5]}
            perfectDrawEnabled={false}
          />
          <Text
            text={slotLabel || categoryLetter}
            fontSize={eqLabel.length > 7 ? 8 : (eqLabel.length > 5 ? 9 : 10)}
            fontFamily="Inter"
            fontStyle="bold"
            fill={color}
            align="center"
            verticalAlign="middle"
            width={42}
            height={42}
            offsetX={21}
            offsetY={21}
            wrap="none"
            perfectDrawEnabled={false}
          />
        </Group>

        {/* Draggable equipment icon — only this part moves */}
        <Group
          x={slot.position_x}
          y={slot.position_y}
          draggable={isDraggable}
          onDragStart={(e) => {
            e.cancelBubble = true;
            isDraggingRef.current = true;
            dragStartTimeRef.current = Date.now();
            origPosRef.current = { x: slot.position_x, y: slot.position_y };
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            isDraggingRef.current = true;
            const elapsed = Date.now() - dragStartTimeRef.current;
            if (elapsed < HOLD_MS) {
              e.target.position({ x: origPosRef.current.x, y: origPosRef.current.y });
            } else if (!isDraggingItemRef.current) {
              isDraggingItemRef.current = true;
              e.target.opacity(0.7);
              if (templateGroupRef.current) templateGroupRef.current.opacity(0.7);
            }
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const dropX = e.target.x();
            const dropY = e.target.y();
            
            // Always snap back
            e.target.position({ x: origPosRef.current.x, y: origPosRef.current.y });
            e.target.opacity(1);
            if (templateGroupRef.current) templateGroupRef.current.opacity(0.3);
            
            const elapsed = Date.now() - dragStartTimeRef.current;
            if (elapsed >= HOLD_MS && isDraggingItemRef.current) {
              if (onDragEnd) onDragEnd(slot.id, dropX, dropY, true);
            }
            
            isDraggingItemRef.current = false;
            dragStartTimeRef.current = 0;
            setTimeout(() => { isDraggingRef.current = false; }, 150);
          }}
          onClick={(e) => {
            e.cancelBubble = true;
            if (isDraggingRef.current) return;
            if (onSelect) onSelect(slot.equipment);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            if (isDraggingRef.current) return;
            if (onSelect) onSelect(slot.equipment);
          }}
          scaleX={invertedScale}
          scaleY={invertedScale}
          opacity={isDraggingItemRef.current ? 0.7 : 1}
        >
          {(isSelected || isHighlighted) && (
            <Circle
              radius={isHighlighted ? 28 : 25}
              fill="transparent"
              stroke={isHighlighted ? '#f59e0b' : '#db2777'}
              strokeWidth={isHighlighted ? 3 : 2}
              dash={isHighlighted ? [6, 4] : [4, 4]}
              perfectDrawEnabled={false}
            />
          )}
          
          <Circle
            radius={21}
            fill={bgColor}
            stroke="white"
            strokeWidth={isSelected ? 3 : 2}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          
          <Text
            text={eqLabel}
            fontSize={eqLabel.length > 7 ? 8 : (eqLabel.length > 5 ? 9 : 10)}
            fontFamily="Inter"
            fontStyle="bold"
            fill="white"
            align="center"
            verticalAlign="middle"
            width={42}
            height={42}
            offsetX={21}
            offsetY={21}
            wrap="none"
            perfectDrawEnabled={false}
          />

          {/* Kondisi Status Indicator */}
          {slot.equipment?.status === 'warning' && (
            <Circle radius={6} fill="#f59e0b" stroke="white" strokeWidth={1.5} offsetX={-12} offsetY={12} perfectDrawEnabled={false} />
          )}
          {slot.equipment?.status === 'damaged' && (
            <Circle radius={6} fill="#ef4444" stroke="white" strokeWidth={1.5} offsetX={-12} offsetY={12} perfectDrawEnabled={false} />
          )}
        </Group>
      </>
    );
  }

  // Empty slot
  const emptyLabel = slotLabel || categoryLetter;

  return (
    <Group
      x={slot.position_x}
      y={slot.position_y}
      draggable={isDraggable}
      onDragStart={(e) => {
        e.cancelBubble = true;
        isDraggingRef.current = true;
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        if (onDragEnd) onDragEnd(slot.id, e.target.x(), e.target.y(), false);
        setTimeout(() => { isDraggingRef.current = false; }, 150);
      }}
      listening={true}
      onClick={(e) => {
        e.cancelBubble = true;
        if (isDraggingRef.current) return;
        if (onSelect) onSelect(null); // null means empty slot clicked
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        if (isDraggingRef.current) return;
        if (onSelect) onSelect(null);
      }}
      scaleX={invertedScale}
      scaleY={invertedScale}
    >
      {(isSelected || isHighlighted) && (
        <Circle
          radius={isHighlighted ? 28 : 25}
          fill="transparent"
          stroke={isHighlighted ? '#f59e0b' : '#db2777'}
          strokeWidth={isHighlighted ? 3 : 2}
          dash={isHighlighted ? [6, 4] : [4, 4]}
          perfectDrawEnabled={false}
        />
      )}

      {/* Background fill for high contrast over floor plan images */}
      <Circle
        radius={21}
        fill="rgba(255, 255, 255, 0.95)"
        stroke={color}
        strokeWidth={2.5}
        dash={[4, 3]}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
      
      {/* Inner subtle tint circle for category color recognition */}
      <Circle
        radius={16}
        fill={color}
        opacity={0.15}
        perfectDrawEnabled={false}
      />

      <Text
        text={emptyLabel}
        fontSize={emptyLabel.length > 7 ? 8 : (emptyLabel.length > 5 ? 9 : 10)}
        fontFamily="Inter"
        fontStyle="bold"
        fill={color}
        align="center"
        verticalAlign="middle"
        width={42}
        height={42}
        offsetX={21}
        offsetY={21}
        wrap="none"
        perfectDrawEnabled={false}
      />
    </Group>
  );
};

export default SlotNode;
