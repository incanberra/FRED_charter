import type { Dispatch, RefObject, SetStateAction } from 'react';
import { exportSvgToJpg } from '../lib/exportJpg';
import { useChart } from '../state/ChartContext';

interface TopBarProps {
  svgRef: RefObject<SVGSVGElement | null>;
  exporting: boolean;
  setExporting: Dispatch<SetStateAction<boolean>>;
}

export function TopBar({ svgRef, exporting, setExporting }: TopBarProps) {
  const { state, dispatch, presets, savePreset, loadPreset, deletePreset } = useChart();

  const handleSave = () => {
    const name = window.prompt('Preset name', state.config.title);
    if (name?.trim()) savePreset(name.trim());
  };

  const handleClear = () => {
    if (
      state.series.length > 0 &&
      !window.confirm(
        'Clear this chart and reset all chart settings? Your saved presets will not be deleted.',
      )
    ) {
      return;
    }

    dispatch({ type: 'CLEAR_CHART' });
  };

  const handleExport = async () => {
    if (!svgRef.current || exporting) return;
    setExporting(true);
    try {
      await exportSvgToJpg({
        svg: svgRef.current,
        title: state.config.title,
        width: state.exportSettings.width,
        height: state.exportSettings.height,
        scale: state.exportSettings.scale,
        quality: state.exportSettings.quality,
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <strong>FRED Chart Studio</strong>
          <small>Policy chart builder</small>
        </div>
      </div>

      <label className="title-field">
        <span>Chart title</span>
        <input
          value={state.config.title}
          onChange={(event) =>
            dispatch({
              type: 'SET_CONFIG',
              patch: { title: event.target.value },
              manualTitle: true,
            })
          }
        />
      </label>

      <div className="topbar-actions">
        {presets.length > 0 && (
          <div className="preset-menu">
            <select
              aria-label="Load saved preset"
              defaultValue=""
              onChange={(event) => {
                const preset = presets.find((item) => item.id === event.target.value);
                if (preset) void loadPreset(preset);
                event.target.value = '';
              }}
            >
              <option value="" disabled>
                Load preset
              </option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              title="Delete a saved preset"
              onClick={() => {
                const name = window.prompt(
                  `Type the preset name to delete:\n${presets.map((item) => item.name).join(', ')}`,
                );
                const preset = presets.find((item) => item.name === name);
                if (preset) deletePreset(preset.id);
              }}
            >
              ×
            </button>
          </div>
        )}
        <button
          className="button clear-button"
          onClick={handleClear}
          disabled={exporting}
        >
          Clear chart
        </button>
        <button className="button secondary-button" onClick={handleSave}>
          Save preset
        </button>
        <button
          className="button primary-button"
          onClick={handleExport}
          disabled={!state.series.length || exporting}
        >
          {exporting ? 'Exporting…' : 'Export JPG'}
        </button>
      </div>
    </header>
  );
}
