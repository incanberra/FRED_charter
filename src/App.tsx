import { useRef, useState } from 'react';
import { ChartCanvas } from './components/ChartCanvas';
import { DatasetExplorer } from './components/DatasetExplorer';
import { Inspector } from './components/Inspector';
import { TopBar } from './components/TopBar';
import type { Aspect, ExportSettings } from './types';
import { useChart } from './state/ChartContext';

const ASPECT_SETTINGS: Record<
  Exclude<Aspect, 'custom'>,
  Pick<ExportSettings, 'aspect' | 'sizePreset' | 'width' | 'height'>
> = {
  '16:9': { aspect: '16:9', sizePreset: 'slide', width: 2400, height: 1350 },
  '4:3': { aspect: '4:3', sizePreset: 'custom', width: 1600, height: 1200 },
  square: { aspect: 'square', sizePreset: 'square', width: 1200, height: 1200 },
};

export function App() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { state, dispatch } = useChart();
  const [exporting, setExporting] = useState(false);

  return (
    <div className="app-shell">
      <TopBar svgRef={svgRef} exporting={exporting} setExporting={setExporting} />
      <main className="workspace">
        <DatasetExplorer />
        <section className="canvas-column">
          <div className="aspect-switcher" role="group" aria-label="Chart aspect ratio">
            {(['16:9', '4:3', 'square'] as const).map((aspect) => (
              <button
                className={state.exportSettings.aspect === aspect ? 'is-active' : ''}
                key={aspect}
                onClick={() =>
                  dispatch({ type: 'SET_EXPORT', patch: ASPECT_SETTINGS[aspect] })
                }
              >
                {aspect === 'square' ? 'Square' : aspect}
              </button>
            ))}
            <button
              className={state.exportSettings.aspect === 'custom' ? 'is-active' : ''}
              onClick={() =>
                dispatch({
                  type: 'SET_EXPORT',
                  patch: { aspect: 'custom', sizePreset: 'custom' },
                })
              }
            >
              Custom
            </button>
          </div>
          <div className="canvas-stage">
            <ChartCanvas ref={svgRef} />
          </div>
          <div className="canvas-status" aria-live="polite">
            <span>
              {state.exportSettings.width} × {state.exportSettings.height}px
            </span>
            <span>
              {state.series.length
                ? `${state.series.length} series · live data`
                : 'Add a series to begin'}
            </span>
          </div>
        </section>
        <Inspector />
      </main>
    </div>
  );
}
