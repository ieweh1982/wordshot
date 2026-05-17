/**
 * RegionSelector - Screen region selection overlay
 *
 * Creates a fullscreen overlay that allows the user to draw a rectangle
 * to select the screen area for danmu capture.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

interface RegionSelectorProps {
  onRegionSelected: (region: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({ onRegionSelected, onCancel }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Use screen coordinates (global) instead of client coordinates (window-relative)
    // In Electron, clientX/Y are relative to the app window, not the screen
    setIsDrawing(true);
    setStartPoint({ x: e.screenX, y: e.screenY });
    setEndPoint({ x: e.screenX, y: e.screenY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return;
    setEndPoint({ x: e.screenX, y: e.screenY });
  }, [isDrawing]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !startPoint || !endPoint) return;
    setIsDrawing(false);

    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    if (width > 10 && height > 10) {
      onRegionSelected({ x, y, width, height });
    } else {
      onCancel();
    }
  }, [isDrawing, startPoint, endPoint, onRegionSelected, onCancel]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getSelectionStyle = () => {
    if (!startPoint || !endPoint) return {};

    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    return {
      left: x,
      top: y,
      width,
      height,
    };
  };

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.3)',
        cursor: 'crosshair',
        zIndex: 99999,
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Instructions */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: 8,
          fontSize: 14,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        按住鼠标左键拖动选择区域，按 ESC 取消
      </div>

      {/* Selection rectangle */}
      {startPoint && endPoint && (
        <div
          style={{
            position: 'absolute',
            ...getSelectionStyle(),
            border: '2px solid #4a90d9',
            background: 'rgba(74, 144, 217, 0.2)',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Size indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: -30,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#4a90d9',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            {Math.abs(endPoint.x - startPoint.x)} × {Math.abs(endPoint.y - startPoint.y)}
          </div>
        </div>
      )}

      {/* Corner handles for visual feedback */}
      {startPoint && endPoint && (
        <>
          <div
            style={{
              position: 'absolute',
              left: Math.min(startPoint.x, endPoint.x) - 4,
              top: Math.min(startPoint.y, endPoint.y) - 4,
              width: 8,
              height: 8,
              background: '#4a90d9',
              borderRadius: '50%',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: Math.max(startPoint.x, endPoint.x) - 4,
              top: Math.min(startPoint.y, endPoint.y) - 4,
              width: 8,
              height: 8,
              background: '#4a90d9',
              borderRadius: '50%',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: Math.min(startPoint.x, endPoint.x) - 4,
              top: Math.max(startPoint.y, endPoint.y) - 4,
              width: 8,
              height: 8,
              background: '#4a90d9',
              borderRadius: '50%',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: Math.max(startPoint.x, endPoint.x) - 4,
              top: Math.max(startPoint.y, endPoint.y) - 4,
              width: 8,
              height: 8,
              background: '#4a90d9',
              borderRadius: '50%',
            }}
          />
        </>
      )}
    </div>
  );
};

export default RegionSelector;