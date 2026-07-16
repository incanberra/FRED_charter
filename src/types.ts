export interface Observation {
  date: string;
  value: number | null;
}

export interface SeriesMeta {
  title: string;
  units: string;
  frequency: string;
  seasonalAdjustment?: string;
  sourceName: string;
  lastUpdated: string;
}

export interface SeriesSelection {
  id: string;
  label: string;
  color: string;
  observations: Observation[];
  meta: SeriesMeta;
  colorIsAutomatic?: boolean;
  loading?: boolean;
  error?: string;
}

export type ChartType =
  | 'line'
  | 'area'
  | 'bar'
  | 'indexed'
  | 'dual-axis'
  | 'snapshot-ranking';

export type Transform = 'lin' | 'pc1' | 'pch' | 'chg';
export type TimeframePreset = '1Y' | '5Y' | '10Y' | 'max' | 'custom';
export type LegendPosition = 'top' | 'right' | 'off';

export interface ChartConfig {
  chartType: ChartType;
  transform: Transform;
  timeframe: {
    start: string;
    end: string;
    preset: TimeframePreset;
  };
  frequency?: {
    value: string;
    aggregationMethod: string;
  };
  showGridlines: boolean;
  legendPosition: LegendPosition;
  recessionShading: boolean;
  title: string;
  subtitle: string;
  note?: string;
  highlightDate?: string;
}

export type Aspect = '16:9' | '4:3' | 'square' | 'custom';
export type SizePreset = 'slide' | 'report' | 'square' | 'custom';

export interface ExportSettings {
  aspect: Aspect;
  sizePreset: SizePreset;
  width: number;
  height: number;
  scale: 1 | 2 | 3;
  quality: number;
}

export interface ChartState {
  series: SeriesSelection[];
  config: ChartConfig;
  exportSettings: ExportSettings;
  titleIsAutomatic: boolean;
}

export interface FredSeriesResult {
  id: string;
  title: string;
  units: string;
  frequency: string;
  seasonal_adjustment: string;
  last_updated: string;
  observation_start?: string;
  observation_end?: string;
  notes?: string;
  source_name?: string;
}

export interface FredTag {
  name: string;
  group_id: string;
  series_count: number;
}

export interface FredCategory {
  id: number;
  name: string;
  parent_id: number;
}

export interface SavedPreset {
  id: string;
  name: string;
  savedAt: string;
  series: Array<Pick<SeriesSelection, 'id' | 'label' | 'color'>>;
  config: ChartConfig;
  exportSettings: ExportSettings;
}
