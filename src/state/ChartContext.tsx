import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { createBrandRamp } from '../brand';
import { rangeForPreset } from '../lib/dates';
import { getObservations, getSeriesMetadata } from '../lib/fred';
import type {
  ChartConfig,
  ChartState,
  ExportSettings,
  FredSeriesResult,
  SavedPreset,
  SeriesSelection,
  TimeframePreset,
} from '../types';

const PRESET_KEY = 'fred-chart-studio-presets-v1';

const initialRange = rangeForPreset('10Y');

export const initialState: ChartState = {
  series: [],
  config: {
    chartType: 'line',
    transform: 'lin',
    timeframe: { ...initialRange, preset: '10Y' },
    showGridlines: true,
    legendPosition: 'top',
    recessionShading: false,
    title: 'Untitled chart',
    subtitle: '',
  },
  exportSettings: {
    aspect: '16:9',
    sizePreset: 'slide',
    width: 2400,
    height: 1350,
    scale: 1,
    quality: 0.9,
  },
  titleIsAutomatic: true,
};

type Action =
  | { type: 'ADD_SERIES'; series: SeriesSelection }
  | { type: 'REMOVE_SERIES'; id: string }
  | { type: 'UPDATE_SERIES'; id: string; patch: Partial<SeriesSelection> }
  | { type: 'REORDER_SERIES'; from: number; to: number }
  | { type: 'SET_CONFIG'; patch: Partial<ChartConfig>; manualTitle?: boolean }
  | { type: 'RESET_AUTOMATIC_TITLE' }
  | { type: 'SET_TIMEFRAME'; preset: TimeframePreset; start: string; end: string }
  | { type: 'SET_EXPORT'; patch: Partial<ExportSettings> }
  | { type: 'LOAD_STATE'; state: ChartState };

function reducer(state: ChartState, action: Action): ChartState {
  switch (action.type) {
    case 'ADD_SERIES': {
      if (state.series.some((series) => series.id === action.series.id)) return state;
      const added = [...state.series, action.series];
      const ramp = createBrandRamp(added.length);
      const series = added.map((item, index) =>
        item.colorIsAutomatic ? { ...item, color: ramp[index] } : item,
      );
      const automaticTitle = buildAutomaticTitle(series);
      return {
        ...state,
        series,
        config: state.titleIsAutomatic
          ? {
              ...state.config,
              title: automaticTitle,
              subtitle: buildAutomaticSubtitle(series),
            }
          : state.config,
      };
    }
    case 'REMOVE_SERIES': {
      const series = state.series.filter((item) => item.id !== action.id);
      return {
        ...state,
        series,
        config: state.titleIsAutomatic
          ? {
              ...state.config,
              title: buildAutomaticTitle(series),
              subtitle: buildAutomaticSubtitle(series),
            }
          : state.config,
      };
    }
    case 'UPDATE_SERIES':
      return {
        ...state,
        series: state.series.map((series) =>
          series.id === action.id ? { ...series, ...action.patch } : series,
        ),
      };
    case 'REORDER_SERIES': {
      const series = [...state.series];
      const [moved] = series.splice(action.from, 1);
      series.splice(action.to, 0, moved);
      return { ...state, series };
    }
    case 'SET_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.patch },
        titleIsAutomatic: action.manualTitle ? false : state.titleIsAutomatic,
      };
    case 'RESET_AUTOMATIC_TITLE':
      return {
        ...state,
        config: {
          ...state.config,
          title: buildAutomaticTitle(state.series),
        },
        titleIsAutomatic: true,
      };
    case 'SET_TIMEFRAME':
      return {
        ...state,
        config: {
          ...state.config,
          timeframe: {
            preset: action.preset,
            start: action.start,
            end: action.end,
          },
        },
      };
    case 'SET_EXPORT':
      return {
        ...state,
        exportSettings: { ...state.exportSettings, ...action.patch },
      };
    case 'LOAD_STATE':
      return action.state;
  }
}

interface ChartContextValue {
  state: ChartState;
  dispatch: Dispatch<Action>;
  addSeries: (series: FredSeriesResult | string, preferredLabel?: string) => Promise<void>;
  setTimeframePreset: (preset: TimeframePreset) => void;
  savePreset: (name: string) => void;
  loadPreset: (preset: SavedPreset) => Promise<void>;
  deletePreset: (id: string) => void;
  presets: SavedPreset[];
}

const ChartContext = createContext<ChartContextValue | null>(null);

export function ChartProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [presetRevision, bumpPresetRevision] = useReducer((value) => value + 1, 0);

  const addSeries = useCallback(
    async (input: FredSeriesResult | string, preferredLabel?: string) => {
      const id = typeof input === 'string' ? input : input.id;
      if (state.series.some((series) => series.id === id)) return;

      const metadata =
        typeof input === 'string'
          ? await getSeriesMetadata(id)
          : {
              result: input,
              meta: {
                title: input.title,
                units: input.units,
                frequency: input.frequency,
                seasonalAdjustment: input.seasonal_adjustment,
                sourceName: input.source_name || 'Federal Reserve Bank of St. Louis',
                lastUpdated: input.last_updated,
              },
            };
      const colors = createBrandRamp(state.series.length + 1);

      dispatch({
        type: 'ADD_SERIES',
        series: {
          id,
          label: preferredLabel || metadata.result.title,
          color: colors[colors.length - 1],
          colorIsAutomatic: true,
          observations: [],
          meta: metadata.meta,
          loading: true,
        },
      });
    },
    [state.series],
  );

  useEffect(() => {
    if (!state.series.length) return;
    const controller = new AbortController();
    const { timeframe, transform, frequency } = state.config;

    state.series.forEach(async (series) => {
      dispatch({ type: 'UPDATE_SERIES', id: series.id, patch: { loading: true, error: undefined } });
      try {
        const observations = await getObservations(
          series.id,
          {
            start: timeframe.start,
            end: timeframe.end,
            units: transform,
            frequency: frequency?.value,
            aggregationMethod: frequency?.aggregationMethod,
          },
          controller.signal,
        );
        dispatch({
          type: 'UPDATE_SERIES',
          id: series.id,
          patch: { observations, loading: false },
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        dispatch({
          type: 'UPDATE_SERIES',
          id: series.id,
          patch: {
            loading: false,
            error: error instanceof Error ? error.message : 'Unable to load observations.',
          },
        });
      }
    });

    return () => controller.abort();
  }, [
    state.config.frequency?.aggregationMethod,
    state.config.frequency?.value,
    state.config.timeframe.end,
    state.config.timeframe.start,
    state.config.transform,
    state.series.map((series) => series.id).join('|'),
  ]);

  const setTimeframePreset = useCallback(
    (preset: TimeframePreset) => {
      const range = rangeForPreset(preset, state.config.timeframe);
      dispatch({ type: 'SET_TIMEFRAME', preset, ...range });
    },
    [state.config.timeframe],
  );

  const presets = useMemo(() => readPresets(), [presetRevision]);

  const savePreset = useCallback(
    (name: string) => {
      const saved: SavedPreset = {
        id: crypto.randomUUID(),
        name,
        savedAt: new Date().toISOString(),
        series: state.series.map(({ id, label, color }) => ({ id, label, color })),
        config: state.config,
        exportSettings: state.exportSettings,
      };
      localStorage.setItem(PRESET_KEY, JSON.stringify([saved, ...readPresets()]));
      bumpPresetRevision();
    },
    [state],
  );

  const loadPreset = useCallback(async (preset: SavedPreset) => {
    const hydratedSeries = await Promise.all(
      preset.series.map(async (savedSeries) => {
        const { meta } = await getSeriesMetadata(savedSeries.id);
        return {
          ...savedSeries,
          colorIsAutomatic: false,
          meta,
          observations: [],
          loading: true,
        } satisfies SeriesSelection;
      }),
    );

    dispatch({
      type: 'LOAD_STATE',
      state: {
        series: hydratedSeries,
        config: preset.config,
        exportSettings: preset.exportSettings,
        titleIsAutomatic: false,
      },
    });
  }, []);

  const deletePreset = useCallback((id: string) => {
    localStorage.setItem(
      PRESET_KEY,
      JSON.stringify(readPresets().filter((preset) => preset.id !== id)),
    );
    bumpPresetRevision();
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      addSeries,
      setTimeframePreset,
      savePreset,
      loadPreset,
      deletePreset,
      presets,
    }),
    [
      state,
      addSeries,
      setTimeframePreset,
      savePreset,
      loadPreset,
      deletePreset,
      presets,
    ],
  );

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

export function useChart() {
  const context = useContext(ChartContext);
  if (!context) throw new Error('useChart must be used within ChartProvider.');
  return context;
}

function readPresets(): SavedPreset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESET_KEY) ?? '[]') as SavedPreset[];
  } catch {
    return [];
  }
}

function buildAutomaticTitle(series: SeriesSelection[]): string {
  if (!series.length) return 'Untitled chart';
  if (series.length === 1) return series[0].meta.title;
  return `${series[0].meta.title} comparison`;
}

function buildAutomaticSubtitle(series: SeriesSelection[]): string {
  if (!series.length) return '';
  const units = [...new Set(series.map((item) => item.meta.units))];
  return units.length === 1 ? units[0] : 'Multiple units';
}
