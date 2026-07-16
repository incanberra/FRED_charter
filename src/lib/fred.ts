import type {
  FredCategory,
  FredSeriesResult,
  FredTag,
  Observation,
  SeriesMeta,
} from '../types';

const API_PATH = '/.netlify/functions/fred';

async function fred<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const query = new URLSearchParams({ endpoint });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });

  const response = await fetch(`${API_PATH}?${query.toString()}`, { signal });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error_message ?? body.error ?? 'FRED request failed.');
  }
  return body as T;
}

export async function searchSeries(
  searchText: string,
  tagNames: string[] = [],
  signal?: AbortSignal,
): Promise<FredSeriesResult[]> {
  const result = await fred<{ seriess: FredSeriesResult[] }>(
    'series/search',
    {
      search_text: searchText,
      tag_names: tagNames.length ? tagNames.join(';') : undefined,
      order_by: 'search_rank',
      sort_order: 'asc',
      limit: 30,
    },
    signal,
  );
  return result.seriess ?? [];
}

export async function searchGeographyTags(
  searchText: string,
  signal?: AbortSignal,
): Promise<FredTag[]> {
  const result = await fred<{ tags: FredTag[] }>(
    'series/search/tags',
    {
      series_search_text: searchText,
      tag_group_id: 'geo',
      order_by: 'series_count',
      sort_order: 'desc',
      limit: 18,
    },
    signal,
  );
  return (result.tags ?? []).filter((tag) => tag.group_id === 'geo');
}

export async function getSeriesMetadata(
  seriesId: string,
  signal?: AbortSignal,
): Promise<{ result: FredSeriesResult; meta: SeriesMeta }> {
  const response = await fred<{ seriess: FredSeriesResult[] }>(
    'series',
    { series_id: seriesId },
    signal,
  );
  const result = response.seriess?.[0];
  if (!result) throw new Error(`Series ${seriesId} was not found.`);

  return {
    result,
    meta: {
      title: result.title,
      units: result.units,
      frequency: result.frequency,
      seasonalAdjustment: result.seasonal_adjustment,
      sourceName: result.source_name || 'Federal Reserve Bank of St. Louis',
      lastUpdated: result.last_updated,
    },
  };
}

export interface ObservationQuery {
  start?: string;
  end?: string;
  units?: string;
  frequency?: string;
  aggregationMethod?: string;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

export async function getObservations(
  seriesId: string,
  query: ObservationQuery = {},
  signal?: AbortSignal,
): Promise<Observation[]> {
  const response = await fred<{ observations: Array<{ date: string; value: string }> }>(
    'series/observations',
    {
      series_id: seriesId,
      observation_start: query.start,
      observation_end: query.end,
      units: query.units,
      frequency: query.frequency,
      aggregation_method: query.aggregationMethod,
      limit: query.limit,
      sort_order: query.sortOrder,
    },
    signal,
  );

  const observations = (response.observations ?? []).map(({ date, value }) => ({
    date,
    value: value === '.' ? null : Number(value),
  }));
  return query.sortOrder === 'desc' ? observations.reverse() : observations;
}

export async function getCategory(
  categoryId: number,
  signal?: AbortSignal,
): Promise<FredCategory> {
  const response = await fred<{ categories: FredCategory[] }>(
    'category',
    { category_id: categoryId },
    signal,
  );
  return response.categories[0];
}

export async function getCategoryChildren(
  categoryId: number,
  signal?: AbortSignal,
): Promise<FredCategory[]> {
  const response = await fred<{ categories: FredCategory[] }>(
    'category/children',
    { category_id: categoryId },
    signal,
  );
  return response.categories ?? [];
}

export async function getCategorySeries(
  categoryId: number,
  signal?: AbortSignal,
): Promise<FredSeriesResult[]> {
  const response = await fred<{ seriess: FredSeriesResult[] }>(
    'category/series',
    {
      category_id: categoryId,
      order_by: 'popularity',
      sort_order: 'desc',
      limit: 30,
    },
    signal,
  );
  return response.seriess ?? [];
}
