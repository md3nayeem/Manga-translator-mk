
import React from 'react';
import { TextBlock } from '../types';

interface Props {
  image: string;
  blocks: TextBlock[];
  selectedId: string | null;
  isEditMode: boolean;
  scale: number;
  offset: { x: number; y: number };
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onWheel: (e: React.WheelEvent) => void;
  imgRef: React.RefObject<HTMLImageElement | null>;
  onImageError?: () => void;
}

export const MangaCanvas: React.FC<Props> = ({
  image, blocks, selectedId, isEditMode, scale, offset,
  onPointerDown, onPointerMove, onPointerUp, onWheel, imgRef,
  onImageError
}) => {
  return (
    <div 
      className={`relative w-full bg-[#0f172a] p-1 rounded-2xl shadow-2xl border border-white/5 overflow-hidden mx-auto select-none ${scale > 1 ? 'touch-none' : 'touch-pan-y'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      <div 
        className="relative w-full transition-transform duration-75 ease-out origin-center"
        style={{ transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)` }}
      >
        <img 
          ref={imgRef} 
          src={image} 
          alt="Manga" 
          className="w-full h-auto block rounded-xl pointer-events-none relative z-0" 
          draggable={false}
          onError={onImageError}
        />
        
        {blocks.map((block) => {
          const isSelected = selectedId === block.id;
          // Ensure showCleaning is true if shape is anything other than 'none'
          const showCleaning = block.visible && block.shape && block.shape !== 'none';
          
          let borderRadius = '4px';
          if (block.shape === 'oval') borderRadius = '50%';
          if (block.shape === 'cloud') borderRadius = '30%';
          if (block.shape === 'rectangular') borderRadius = '8px';

          return (
            <div 
              key={block.id} 
              data-block-id={block.id}
              className={`absolute transition-all duration-200 ${isEditMode && isSelected ? 'z-[100]' : 'z-[50]'} ${isEditMode ? 'border border-indigo-500/50 border-dashed' : ''}`}
              style={{
                left: `${block.position.left}%`,
                top: `${block.position.top}%`,
                width: `${block.position.width}%`,
                height: `${block.position.height}%`,
                display: block.visible ? 'block' : 'none',
                cursor: isEditMode ? 'move' : 'default',
                pointerEvents: isEditMode ? 'auto' : 'none',
                touchAction: isEditMode ? 'none' : 'auto',
                backgroundColor: isEditMode && !showCleaning ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
              }}
            >
              {/* Forceful White Cleaning Layer */}
              {showCleaning && (
                <div 
                  className="absolute pointer-events-none"
                  style={{
                    // Slightly larger than the text box to ensure full coverage
                    inset: '-2px', 
                    backgroundColor: '#ffffff',
                    borderRadius: borderRadius,
                    opacity: 1,
                    zIndex: 1,
                    boxShadow: '0 0 2px rgba(255,255,255,0.8)',
                    border: isEditMode && isSelected ? '2px solid #6366f1' : 'none'
                  }}
                />
              )}

              {/* Bengali Text Layer */}
              <div 
                className={`absolute inset-0 flex items-center justify-center pointer-events-none text-center px-2 ${isEditMode && isSelected ? 'ring-2 ring-indigo-500 rounded' : ''}`}
                style={{ zIndex: 20 }}
              >
                <div 
                  className="w-full leading-tight bengali-font break-words drop-shadow-sm"
                  style={{ 
                    color: block.style.fill,
                    fontWeight: block.style.bold ? '700' : '400',
                    fontSize: `${block.style.fontSize}px`,
                    // SFX outline
                    textShadow: block.shape === 'none' 
                      ? '1px 1px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white' 
                      : 'none'
                  }}
                >
                  {block.translatedText}
                </div>
              </div>

              {/* Resize Handles */}
              {isEditMode && isSelected && (
                <div className="absolute inset-0 z-50 pointer-events-none">
                  <div data-handle="nw" className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full -top-2 -left-2 cursor-nw-resize shadow-md pointer-events-auto" />
                  <div data-handle="ne" className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full -top-2 -right-2 cursor-ne-resize shadow-md pointer-events-auto" />
                  <div data-handle="sw" className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full -bottom-2 -left-2 cursor-sw-resize shadow-md pointer-events-auto" />
                  <div data-handle="se" className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full -bottom-2 -right-2 cursor-se-resize shadow-md pointer-events-auto" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
