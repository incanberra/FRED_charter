import {
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createBrandRamp } from '../brand';
import { QUICK_ACCESS_SERIES } from '../config/quickAccess';
import {
  getCategory,
  getCategoryChildren,
  getCategorySeries,
  getObservations,
  searchGeographyTags,
  searchSeries,
} from '../lib/fred';
import { useChart } from '../state/ChartContext';
import type { FredCategory, FredSeriesResult, FredTag } from '../types';

type ExplorerTab = 'search' | 'browse' | 'quick' | 'selected';

export function DatasetExplorer() {
  const { state } = useChart();
  const [tab, setTab] = useState<ExplorerTab>('search');

  return (
    <aside className="left-panel panel">
      <div className="panel-heading">
        <p className="eyebrow">Dataset explorer</p>
        <h2>Find & collect</h2>
      </div>
      <nav className="tabs explorer-tabs" aria-label="Dataset explorer">
        <button className={tab === 'search' ? 'is-active' : ''} onClick={() => setTab('search')}>
          Search
        </button>
        <button className={tab === 'browse' ? 'is-active' : ''} onClick={() => setTab('browse')}>
          Browse
        </button>
        <button className={tab === 'quick' ? 'is-active' : ''} onClick={() => setTab('quick')}>
          Quick
        </button>
        <button
          className={tab === 'selected' ? 'is-active' : ''}
          onClick={() => setTab('selected')}
        >
          Selected <span className="count-badge">{state.series.length}</span>
        </button>
      </nav>
      <div className="explorer-content">
        {tab === 'search' && <SearchTab />}
        {tab === 'browse' && <BrowseTab />}
        {tab === 'quick' && <QuickAccessTab />}
        {tab === 'selected' && <SelectedTab />}
      </div>
    </aside>
  );
}

function SearchTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FredSeriesResult[]>([]);
  const [tags, setTags] = useState<FredTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setTags([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const [seriesResults, geographyTags] = await Promise.all([
          searchSeries(query.trim(), selectedTags, controller.signal),
          searchGeographyTags(query.trim(), controller.signal),
        ]);
        setResults(seriesResults);
        setTags(geographyTags);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof Error ? requestError.message : 'Search could not be completed.',
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, selectedTags]);

  return (
    <>
      <label className="search-box">
        <span className="search-icon">⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search GDP, inflation, Japan…"
          autoFocus
        />
        {loading && <span className="spinner" aria-label="Searching" />}
      </label>
      {tags.length > 0 && (
        <div className="tag-section">
          <span className="field-label">Geography</span>
          <div className="chip-list">
            {tags.map((tag) => {
              const selected = selectedTags.includes(tag.name);
              return (
                <button
                  className={`chip ${selected ? 'is-active' : ''}`}
                  key={tag.name}
                  onClick={() =>
                    setSelectedTags((current) =>
                      selected
                        ? current.filter((item) => item !== tag.name)
                        : [...current, tag.name],
                    )
                  }
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {error && <InlineError message={error} />}
      {!query && (
        <EmptyState
          title="Search the FRED catalogue"
          body="Use plain language. Add geography chips to narrow a concept across countries."
        />
      )}
      <div className="result-list">
        {results.map((result) => (
          <SeriesCard key={result.id} result={result} />
        ))}
      </div>
    </>
  );
}

function BrowseTab() {
  const [stack, setStack] = useState<FredCategory[]>([]);
  const [children, setChildren] = useState<FredCategory[]>([]);
  const [series, setSeries] = useState<FredSeriesResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentId = stack.at(-1)?.id ?? 0;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      currentId === 0 ? Promise.resolve({ id: 0, name: 'All categories', parent_id: 0 }) : getCategory(currentId, controller.signal),
      getCategoryChildren(currentId, controller.signal),
      currentId === 0 ? Promise.resolve([]) : getCategorySeries(currentId, controller.signal),
    ])
      .then(([category, nextChildren, nextSeries]) => {
        if (currentId !== 0 && !stack.some((item) => item.id === currentId)) {
          setStack((current) => [...current, category]);
        }
        setChildren(nextChildren);
        setSeries(nextSeries);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Categories could not be loaded.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentId]);

  const openCategory = (category: FredCategory) => setStack((current) => [...current, category]);

  return (
    <>
      <div className="breadcrumbs">
        <button onClick={() => setStack([])}>All</button>
        {stack.map((category, index) => (
          <button key={category.id} onClick={() => setStack(stack.slice(0, index + 1))}>
            / {category.name}
          </button>
        ))}
      </div>
      {loading && <div className="loading-line">Loading categories…</div>}
      {error && <InlineError message={error} />}
      <div className="category-list">
        {children.map((category) => (
          <button key={category.id} onClick={() => openCategory(category)}>
            <span>{category.name}</span>
            <span>›</span>
          </button>
        ))}
      </div>
      <div className="result-list">
        {series.map((result) => (
          <SeriesCard key={result.id} result={result} />
        ))}
      </div>
    </>
  );
}

function QuickAccessTab() {
  const { addSeries, state } = useChart();
  return (
    <>
      <div className="section-copy">
        <strong>Macro essentials</strong>
        <p>Edit this shortlist in <code>src/config/quickAccess.ts</code>.</p>
      </div>
      <div className="quick-list">
        {QUICK_ACCESS_SERIES.map((series) => {
          const selected = state.series.some((item) => item.id === series.id);
          return (
            <button
              key={series.id}
              disabled={selected}
              onClick={() => void addSeries(series.id, series.label)}
            >
              <span>
                <strong>{series.label}</strong>
                <small>{series.id}</small>
              </span>
              <span>{selected ? 'Added' : '+'}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function SelectedTab() {
  const { state, dispatch } = useChart();
  const dragIndex = useRef<number | null>(null);
  const ramp = useMemo(() => createBrandRamp(12), []);

  if (!state.series.length) {
    return (
      <EmptyState
        title="Your basket is empty"
        body="Add series from Search, Browse, or Quick access. They will appear here for labelling and ordering."
      />
    );
  }

  const handleDrop = (event: DragEvent, to: number) => {
    event.preventDefault();
    if (dragIndex.current !== null && dragIndex.current !== to) {
      dispatch({ type: 'REORDER_SERIES', from: dragIndex.current, to });
    }
    dragIndex.current = null;
  };

  return (
    <div className="selected-list">
      {state.series.map((series, index) => (
        <article
          className="selected-card"
          key={series.id}
          draggable
          onDragStart={() => {
            dragIndex.current = index;
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleDrop(event, index)}
        >
          <div className="selected-card-head">
            <span className="drag-handle" title="Drag to reorder">
              ⠿
            </span>
            <div>
              <strong>{series.id}</strong>
              <small>{series.meta.units}</small>
            </div>
            <button
              className="remove-button"
              onClick={() => dispatch({ type: 'REMOVE_SERIES', id: series.id })}
              aria-label={`Remove ${series.label}`}
            >
              ×
            </button>
          </div>
          <label>
            <span>Short label</span>
            <input
              value={series.label}
              onChange={(event) =>
                dispatch({
                  type: 'UPDATE_SERIES',
                  id: series.id,
                  patch: { label: event.target.value },
                })
              }
            />
          </label>
          <div className="color-row">
            <span>Series colour</span>
            <div className="swatches">
              {ramp.map((color) => (
                <button
                  key={color}
                  style={{ backgroundColor: color }}
                  className={series.color === color ? 'is-active' : ''}
                  aria-label={`Use colour ${color}`}
                  onClick={() =>
                    dispatch({
                      type: 'UPDATE_SERIES',
                  id: series.id,
                  patch: { color, colorIsAutomatic: false },
                })
                  }
                />
              ))}
            </div>
          </div>
          {series.loading && <small className="series-state">Refreshing observations…</small>}
          {series.error && <small className="series-state error-text">{series.error}</small>}
        </article>
      ))}
    </div>
  );
}

function SeriesCard({ result }: { result: FredSeriesResult }) {
  const { state, addSeries } = useChart();
  const selected = state.series.some((series) => series.id === result.id);

  return (
    <article className="series-card">
      <button disabled={selected} onClick={() => void addSeries(result)}>
        <div className="series-card-topline">
          <span className="series-id">{result.id}</span>
          <span className="add-series">{selected ? 'Added' : '+'}</span>
        </div>
        <strong>{result.title}</strong>
        <div className="series-meta">
          <span>{result.units}</span>
          <span>{result.frequency}</span>
          <span>{result.seasonal_adjustment}</span>
        </div>
        <Sparkline seriesId={result.id} />
        <small>Updated {formatUpdated(result.last_updated)}</small>
      </button>
    </article>
  );
}

function Sparkline({ seriesId }: { seriesId: string }) {
  const [values, setValues] = useState<number[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    getObservations(
      seriesId,
      { limit: 36, sortOrder: 'desc' },
      controller.signal,
    )
      .then((observations) =>
        setValues(
          observations
            .map((observation) => observation.value)
            .filter((value): value is number => value !== null),
        ),
      )
      .catch(() => undefined);
    return () => controller.abort();
  }, [seriesId]);

  if (values.length < 2) return <div className="sparkline-placeholder" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 220;
      const y = 42 - ((value - min) / range) * 34;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="sparkline" viewBox="0 0 220 50" aria-hidden="true">
      <polyline points={points} fill="none" />
    </svg>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <div className="empty-glyph">⌁</div>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return <div className="inline-error">{message}</div>;
}

function formatUpdated(value: string) {
  if (!value) return '—';
  return new Date(value.replace(' ', 'T')).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
