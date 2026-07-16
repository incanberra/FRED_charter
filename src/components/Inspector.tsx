import { rangeForPreset } from '../lib/dates';
import { useChart } from '../state/ChartContext';
import type {
  ChartType,
  LegendPosition,
  SizePreset,
  Transform,
} from '../types';

const CHART_TYPES: Array<{ value: ChartType; label: string; hint: string }> = [
  { value: 'line', label: 'Line', hint: 'One or more time series' },
  { value: 'area', label: 'Area', hint: 'Best for a single series' },
  { value: 'bar', label: 'Column', hint: 'Period-by-period values' },
  { value: 'indexed', label: 'Indexed (100)', hint: 'Rebase visible range' },
  { value: 'dual-axis', label: 'Dual axis', hint: 'Line + bars, two series' },
  { value: 'snapshot-ranking', label: 'Snapshot ranking', hint: 'Latest values' },
];

const TRANSFORMS: Array<{ value: Transform; label: string }> = [
  { value: 'lin', label: 'Level' },
  { value: 'pc1', label: '% change year-over-year' },
  { value: 'pch', label: '% change previous period' },
  { value: 'chg', label: 'Change' },
];

const SIZE_PRESETS: Record<
  Exclude<SizePreset, 'custom'>,
  { width: number; height: number; aspect: '16:9' | 'square' | 'custom' }
> = {
  slide: { width: 2400, height: 1350, aspect: '16:9' },
  report: { width: 1600, height: 1000, aspect: 'custom' },
  square: { width: 1200, height: 1200, aspect: 'square' },
};

export function Inspector() {
  const { state, dispatch, setTimeframePreset } = useChart();
  const config = state.config;
  const output = state.exportSettings;

  return (
    <aside className="right-panel panel">
      <div className="panel-heading">
        <p className="eyebrow">Inspector</p>
        <h2>Configure</h2>
      </div>

      <div className="accordion-stack">
        <details open>
          <summary>Chart type</summary>
          <div className="accordion-body">
            <div className="choice-grid">
              {CHART_TYPES.map((type) => (
                <button
                  key={type.value}
                  className={config.chartType === type.value ? 'is-active' : ''}
                  onClick={() =>
                    dispatch({ type: 'SET_CONFIG', patch: { chartType: type.value } })
                  }
                >
                  <strong>{type.label}</strong>
                  <small>{type.hint}</small>
                </button>
              ))}
            </div>
          </div>
        </details>

        <details open>
          <summary>Timeframe</summary>
          <div className="accordion-body form-stack">
            <div className="segmented">
              {(['1Y', '5Y', '10Y', 'max'] as const).map((preset) => (
                <button
                  key={preset}
                  className={config.timeframe.preset === preset ? 'is-active' : ''}
                  onClick={() => setTimeframePreset(preset)}
                >
                  {preset === 'max' ? 'Max' : preset}
                </button>
              ))}
            </div>
            <div className="field-pair">
              <label>
                <span>Start</span>
                <input
                  type="date"
                  value={config.timeframe.start}
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_TIMEFRAME',
                      preset: 'custom',
                      start: event.target.value,
                      end: config.timeframe.end,
                    })
                  }
                />
              </label>
              <label>
                <span>End</span>
                <input
                  type="date"
                  value={config.timeframe.end}
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_TIMEFRAME',
                      preset: 'custom',
                      start: config.timeframe.start,
                      end: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            <label>
              <span>Frequency override</span>
              <select
                value={config.frequency?.value ?? ''}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_CONFIG',
                    patch: {
                      frequency: event.target.value
                        ? {
                            value: event.target.value,
                            aggregationMethod:
                              config.frequency?.aggregationMethod ?? 'avg',
                          }
                        : undefined,
                    },
                  })
                }
              >
                <option value="">Native frequency</option>
                <option value="d">Daily</option>
                <option value="w">Weekly</option>
                <option value="m">Monthly</option>
                <option value="q">Quarterly</option>
                <option value="a">Annual</option>
              </select>
            </label>
            {config.frequency && (
              <label>
                <span>Aggregation</span>
                <select
                  value={config.frequency.aggregationMethod}
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_CONFIG',
                      patch: {
                        frequency: {
                          ...config.frequency!,
                          aggregationMethod: event.target.value,
                        },
                      },
                    })
                  }
                >
                  <option value="avg">Average</option>
                  <option value="sum">Sum</option>
                  <option value="eop">End of period</option>
                </select>
              </label>
            )}
            <button
              className="text-button"
              onClick={() => {
                const range = rangeForPreset('10Y');
                dispatch({ type: 'SET_TIMEFRAME', preset: '10Y', ...range });
              }}
            >
              Reset to 10 years
            </button>
          </div>
        </details>

        <details open>
          <summary>Transform</summary>
          <div className="accordion-body">
            <label>
              <span>FRED transform</span>
              <select
                value={config.transform}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_CONFIG',
                    patch: { transform: event.target.value as Transform },
                  })
                }
              >
                {TRANSFORMS.map((transform) => (
                  <option key={transform.value} value={transform.value}>
                    {transform.label}
                  </option>
                ))}
              </select>
            </label>
            {config.chartType === 'indexed' && (
              <p className="control-note">
                Values are additionally rebased client-side to 100 at the first visible non-null
                observation.
              </p>
            )}
          </div>
        </details>

        <details>
          <summary>Style</summary>
          <div className="accordion-body form-stack">
            <Toggle
              label="Gridlines"
              checked={config.showGridlines}
              onChange={(checked) =>
                dispatch({ type: 'SET_CONFIG', patch: { showGridlines: checked } })
              }
            />
            <Toggle
              label="US recession shading"
              checked={config.recessionShading}
              onChange={(checked) =>
                dispatch({ type: 'SET_CONFIG', patch: { recessionShading: checked } })
              }
            />
            <label>
              <span>Legend</span>
              <select
                value={config.legendPosition}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_CONFIG',
                    patch: { legendPosition: event.target.value as LegendPosition },
                  })
                }
              >
                <option value="top">Top</option>
                <option value="right">Right</option>
                <option value="off">Off</option>
              </select>
            </label>
            <p className="control-note">
              Chart typeface uses the <code>--brand-font</code> CSS token. Swap the corporate font
              there when supplied.
            </p>
          </div>
        </details>

        <details>
          <summary>Annotations</summary>
          <div className="accordion-body form-stack">
            <label>
              <span>Subtitle</span>
              <textarea
                rows={2}
                value={config.subtitle}
                onChange={(event) =>
                  dispatch({ type: 'SET_CONFIG', patch: { subtitle: event.target.value } })
                }
              />
            </label>
            <label>
              <span>Freeform note</span>
              <textarea
                rows={3}
                value={config.note ?? ''}
                placeholder="Optional chart callout"
                onChange={(event) =>
                  dispatch({ type: 'SET_CONFIG', patch: { note: event.target.value } })
                }
              />
            </label>
            <label>
              <span>Highlight date</span>
              <input
                type="date"
                value={config.highlightDate ?? ''}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_CONFIG',
                    patch: { highlightDate: event.target.value || undefined },
                  })
                }
              />
            </label>
          </div>
        </details>

        <details open>
          <summary>Export</summary>
          <div className="accordion-body form-stack">
            <label>
              <span>Size preset</span>
              <select
                value={output.sizePreset}
                onChange={(event) => {
                  const value = event.target.value as SizePreset;
                  dispatch({
                    type: 'SET_EXPORT',
                    patch:
                      value === 'custom'
                        ? { sizePreset: 'custom', aspect: 'custom' }
                        : { sizePreset: value, ...SIZE_PRESETS[value] },
                  });
                }}
              >
                <option value="slide">Slide · 2400 × 1350</option>
                <option value="report">Report · 1600 × 1000</option>
                <option value="square">Square · 1200 × 1200</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <div className="field-pair">
              <label>
                <span>Width</span>
                <input
                  type="number"
                  min={600}
                  max={6000}
                  value={output.width}
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_EXPORT',
                      patch: {
                        width: Number(event.target.value),
                        aspect: 'custom',
                        sizePreset: 'custom',
                      },
                    })
                  }
                />
              </label>
              <label>
                <span>Height</span>
                <input
                  type="number"
                  min={400}
                  max={6000}
                  value={output.height}
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_EXPORT',
                      patch: {
                        height: Number(event.target.value),
                        aspect: 'custom',
                        sizePreset: 'custom',
                      },
                    })
                  }
                />
              </label>
            </div>
            <label>
              <span>Pixel density</span>
              <div className="segmented">
                {([1, 2, 3] as const).map((scale) => (
                  <button
                    key={scale}
                    className={output.scale === scale ? 'is-active' : ''}
                    onClick={() => dispatch({ type: 'SET_EXPORT', patch: { scale } })}
                  >
                    {scale}×
                  </button>
                ))}
              </div>
            </label>
            <label>
              <span>JPG quality · {Math.round(output.quality * 100)}%</span>
              <input
                type="range"
                min={0.6}
                max={1}
                step={0.01}
                value={output.quality}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_EXPORT',
                    patch: { quality: Number(event.target.value) },
                  })
                }
              />
            </label>
            <div className="export-summary">
              Output: {output.width * output.scale} × {output.height * output.scale}px
            </div>
          </div>
        </details>
      </div>
    </aside>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}
