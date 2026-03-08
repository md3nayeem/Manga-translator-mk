
import React, { useState, useCallback } from 'react';
import { Position } from '../types';

export const useMangaEditor = () => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [interaction, setInteraction] = useState<{
    type: 'drag' | 'resize';
    direction?: string;
    blockId: string;
    startPos: { x: number; y: number };
    initialBlockPos: Position;
  } | null>(null);

  // Added React to imports to ensure React.WheelEvent namespace is correctly resolved
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(1, scale + delta), 4);
    setScale(newScale);
    if (newScale === 1) setOffset({ x: 0, y: 0 });
  }, [scale]);

  const startPanning = (x: number, y: number) => {
    setIsPanning(true);
    setLastMousePos({ x, y });
  };

  const updatePanning = (x: number, y: number) => {
    if (!isPanning) return;
    const dx = x - lastMousePos.x;
    const dy = y - lastMousePos.y;
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastMousePos({ x, y });
  };

  return {
    scale, setScale,
    offset, setOffset,
    isPanning, setIsPanning,
    interaction, setInteraction,
    handleWheel,
    startPanning,
    updatePanning
  };
};
