import React, { useCallback, useMemo } from 'react';
import GridLayout from 'react-grid-layout';
import { useLayoutStore, LayoutItem } from '../../stores/layoutStore';
import 'react-grid-layout/css/styles.css';

export interface DraggablePanelProps {
  scriptPanel: React.ReactNode;
  danmuPanel: React.ReactNode;
  ammoPanel: React.ReactNode;
  width: number;
  height: number;
  rowHeight?: number;
  cols?: number;
  margin?: [number, number];
  containerPadding?: [number, number];
  onLayoutChange?: (layout: LayoutItem[]) => void;
}

export const DraggablePanel: React.FC<DraggablePanelProps> = ({
  scriptPanel,
  danmuPanel,
  ammoPanel,
  width,
  height,
  rowHeight = 50,
  cols = 12,
  margin = [8, 8],
  containerPadding = [8, 8],
  onLayoutChange,
}) => {
  const { layout, setLayout, saveLayout } = useLayoutStore();

  const handleLayoutChange = useCallback(
    (newLayout: GridLayout.Layout[]) => {
      const layoutItems: LayoutItem[] = newLayout.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
      }));
      setLayout(layoutItems);
      saveLayout(layoutItems);
      onLayoutChange?.(layoutItems);
    },
    [setLayout, saveLayout, onLayoutChange]
  );

  const panelComponents = useMemo(
    () => ({
      script: scriptPanel,
      danmu: danmuPanel,
      ammo: ammoPanel,
    }),
    [scriptPanel, danmuPanel, ammoPanel]
  );

  return (
    <GridLayout
      className="draggable-panel-layout"
      layout={layout}
      cols={cols}
      rowHeight={rowHeight}
      width={width}
      margin={margin}
      containerPadding={containerPadding}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".panel-drag-handle"
      resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 'n', 's']}
      useCSSTransforms
      compactType="vertical"
      preventCollision={false}
    >
      {layout.map((item) => (
        <div key={item.i} className={`panel-container panel-${item.i}`}>
          <div className="panel-drag-handle" title="拖拽调整位置">
            <span className="panel-title">
              {item.i === 'script' && '主提词区'}
              {item.i === 'danmu' && '公屏互动'}
              {item.i === 'ammo' && '话术弹药带'}
            </span>
            <span className="panel-resize-hint">⋮⋮</span>
          </div>
          <div className="panel-content">{panelComponents[item.i as keyof typeof panelComponents]}</div>
        </div>
      ))}
    </GridLayout>
  );
};

export default DraggablePanel;
