import {
  area,
  curveMonotoneX,
  extent,
  line,
  max,
  scaleBand,
  scaleLinear,
  scaleTime,
} from 'd3';
import type { ScaleLinear, ScaleTime } from 'd3';
import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { brand } from '../brand';
import {
  axisUnitLabel,
  formatAnnotationDate,
  formatChartDate,
  formatChartValue,
  lineDashPattern,
  referenceLineFor,
} from '../lib/chartFormatting';
import { getObservations } from '../lib/fred';
import { useChart } from '../state/ChartContext';
import type { Observation, SeriesSelection, Transform } from '../types';

interface Point {
  date: Date;
  dateKey: string;
  value: number | null;
}

interface PreparedSeries extends SeriesSelection {
  points: Point[];
}

const parseDate = (value: string) => new Date(`${value}T00:00:00`);

export const ChartCanvas = forwardRef<SVGSVGElement>(function ChartCanvas(_, ref) {
  const { state } = useChart();
  const { config, exportSettings } = state;
  const [recessionData, setRecessionData] = useState<Observation[]>([]);
  const clipId = `chart-clip-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    if (!config.recessionShading) {
      setRecessionData([]);
      return;
    }
    const controller = new AbortController();
    getObservations(
      'USREC',
      {
        start: config.timeframe.start,
        end: config.timeframe.end,
        units: 'lin',
      },
      controller.signal,
    )
      .then(setRecessionData)
      .catch(() => setRecessionData([]));
    return () => controller.abort();
  }, [
    config.recessionShading,
    config.timeframe.end,
    config.timeframe.start,
  ]);

  const prepared = useMemo(
    () =>
      state.series.map((series) => ({
        ...series,
        points: preparePoints(series, config.chartType === 'indexed'),
      })),
    [config.chartType, state.series],
  );

  const width = exportSettings.width;
  const height = exportSettings.height;
  const compact = width / height < 1.15;
  const footerHeight = Math.max(84, height * 0.075);
  const titleTop = Math.max(68, height * 0.06);
  const titleSize = chartTitleSize(width);
  const titleLineCount = Math.max(
    1,
    wrapText(config.title, chartTitleCharactersPerLine(width, compact)).length,
  );
  const wrappedTitleHeight = (titleLineCount - 1) * titleSize * 1.04;
  const supportsEndLabels = ['line', 'area', 'indexed', 'dual-axis'].includes(
    config.chartType,
  );
  const endLabelSeries = config.chartType === 'dual-axis' ? prepared.slice(0, 1) : prepared;
  const endLabelWidth =
    config.showEndLabels && supportsEndLabels && endLabelSeries.length
      ? Math.min(360, width * 0.18)
      : 0;
  const plotTop =
    titleTop +
    Math.max(105, height * 0.095) +
    wrappedTitleHeight +
    (config.legendPosition === 'top' && state.series.length ? 60 : 0);
  const legendRightWidth =
    config.legendPosition === 'right' && state.series.length
      ? Math.min(430, width * 0.22)
      : 0;
  const margin = {
    left: Math.max(115, width * 0.065),
    right: Math.max(85, width * 0.045) + legendRightWidth + endLabelWidth,
    top: plotTop,
    bottom: footerHeight + Math.max(100, height * 0.08),
  };
  const plotWidth = Math.max(100, width - margin.left - margin.right);
  const plotHeight = Math.max(100, height - margin.top - margin.bottom);

  const allPoints = prepared.flatMap((series) =>
    series.points.filter((point) => point.value !== null),
  );
  const dateExtent = extent(allPoints, (point) => point.date);
  const fallbackStart = config.timeframe.start
    ? parseDate(config.timeframe.start)
    : new Date(new Date().setFullYear(new Date().getFullYear() - 10));
  const fallbackEnd = config.timeframe.end ? parseDate(config.timeframe.end) : new Date();
  const xDomain: [Date, Date] = [
    dateExtent[0] ?? fallbackStart,
    dateExtent[1] ?? fallbackEnd,
  ];
  if (+xDomain[0] === +xDomain[1]) {
    xDomain[0] = new Date(+xDomain[0] - 86400000);
    xDomain[1] = new Date(+xDomain[1] + 86400000);
  }

  const x = scaleTime().domain(xDomain).range([margin.left, margin.left + plotWidth]);
  const primarySeries =
    config.chartType === 'dual-axis' ? prepared.slice(0, 1) : prepared;
  const referenceLine = config.showReferenceLine
    ? referenceLineFor(config.chartType, config.transform)
    : null;
  const primaryValues = primarySeries.flatMap((series) =>
    series.points
      .map((point) => point.value)
      .filter((value): value is number => value !== null),
  );
  if (referenceLine) primaryValues.push(referenceLine.value);
  const y = scaleLinear()
    .domain(paddedDomain(primaryValues))
    .nice(6)
    .range([margin.top + plotHeight, margin.top]);

  const secondaryValues =
    config.chartType === 'dual-axis'
      ? (prepared[1]?.points
          .map((point) => point.value)
          .filter((value): value is number => value !== null) ?? [])
      : [];
  if (referenceLine && config.chartType === 'dual-axis') {
    secondaryValues.push(referenceLine.value);
  }
  const yRight = scaleLinear()
    .domain(paddedDomain(secondaryValues, true))
    .nice(6)
    .range([margin.top + plotHeight, margin.top]);

  const xTicks = x.ticks(Math.max(4, Math.floor(plotWidth / 300)));
  const yTicks = y.ticks(6);
  const yRightTicks = yRight.ticks(6);
  const sourceFooter = buildSourceFooter(state.series);
  const recessionIntervals = getRecessionIntervals(recessionData, xDomain[1]);
  const primaryBaseline = y(baselineForDomain(y.domain()));
  const secondaryBaseline = yRight(baselineForDomain(yRight.domain()));
  const primaryUnits = commonUnits(primarySeries);
  const annotationSeries =
    prepared.find((series) => series.id === config.emphasizedSeriesId) ?? prepared[0];
  const annotationPoint =
    config.highlightDate && annotationSeries
      ? nearestPoint(annotationSeries.points, parseDate(config.highlightDate))
      : null;
  const annotationYScale =
    config.chartType === 'dual-axis' && annotationSeries?.id === prepared[1]?.id
      ? yRight
      : y;

  if (config.chartType === 'snapshot-ranking') {
    return (
      <SnapshotChart
        ref={ref}
        width={width}
        height={height}
        margin={margin}
        plotWidth={plotWidth}
        plotHeight={plotHeight}
        series={prepared}
        sourceFooter={sourceFooter}
      />
    );
  }

  return (
    <svg
      ref={ref}
      className="chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`${config.title}. ${config.subtitle}`}
      style={{
        background: brand.colors.background,
        fontFamily: 'var(--brand-font)',
      }}
    >
      <rect width={width} height={height} fill={brand.colors.background} />
      <defs>
        <clipPath id={clipId}>
          <rect
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotHeight}
          />
        </clipPath>
      </defs>

      <ChartHeader
        width={width}
        titleTop={titleTop}
        compact={compact}
        series={state.series}
      />

      {config.legendPosition !== 'off' && state.series.length > 0 && (
        <Legend
          series={state.series}
          position={config.legendPosition}
          x={config.legendPosition === 'right' ? margin.left + plotWidth + 60 : margin.left}
          y={config.legendPosition === 'right' ? margin.top : plotTop - 52}
          availableWidth={config.legendPosition === 'right' ? legendRightWidth - 70 : plotWidth}
          emphasizedSeriesId={config.emphasizedSeriesId}
          useLinePatterns={config.useLinePatterns}
        />
      )}

      <g className="plot" clipPath={`url(#${clipId})`}>
        {config.recessionShading &&
          recessionIntervals.map((interval) => (
            <rect
              className="recession-band"
              key={interval.start.toISOString()}
              x={x(interval.start)}
              y={margin.top}
              width={Math.max(1, x(interval.end) - x(interval.start))}
              height={plotHeight}
            />
          ))}

        {config.showGridlines &&
          yTicks.map((tick) => (
            <line
              className="gridline"
              key={tick}
              x1={margin.left}
              x2={margin.left + plotWidth}
              y1={y(tick)}
              y2={y(tick)}
            />
          ))}

        {referenceLine && (
          <line
            className="reference-line"
            x1={margin.left}
            x2={margin.left + plotWidth}
            y1={y(referenceLine.value)}
            y2={y(referenceLine.value)}
          />
        )}

        {!referenceLine && y.domain()[0] < 0 && y.domain()[1] > 0 && (
          <line
            className="zero-line"
            x1={margin.left}
            x2={margin.left + plotWidth}
            y1={y(0)}
            y2={y(0)}
          />
        )}

        {config.chartType === 'area' &&
          prepared.map((series) => {
            const areaPath = area<Point>()
              .defined((point) => point.value !== null)
              .x((point) => x(point.date))
              .y0(primaryBaseline)
              .y1((point) => y(point.value!))
              .curve(curveMonotoneX)(series.points);
            return areaPath ? (
              <path
                key={series.id}
                className={seriesClassName('series-area', series.id, config.emphasizedSeriesId)}
                d={areaPath}
                fill={series.color}
              />
            ) : null;
          })}

        {(config.chartType === 'line' ||
          config.chartType === 'indexed' ||
          config.chartType === 'area') &&
          prepared.map((series, index) => (
            <SeriesLine
              key={series.id}
              series={series}
              seriesIndex={index}
              emphasizedSeriesId={config.emphasizedSeriesId}
              useLinePatterns={config.useLinePatterns}
              x={x}
              y={y}
            />
          ))}

        {config.chartType === 'bar' && (
          <GroupedBars
            series={prepared}
            x={x}
            y={y}
            plotWidth={plotWidth}
            baseline={primaryBaseline}
            emphasizedSeriesId={config.emphasizedSeriesId}
          />
        )}

        {config.chartType === 'dual-axis' && prepared[0] && (
          <SeriesLine
            series={prepared[0]}
            seriesIndex={0}
            emphasizedSeriesId={config.emphasizedSeriesId}
            useLinePatterns={config.useLinePatterns}
            x={x}
            y={y}
          />
        )}
        {config.chartType === 'dual-axis' && prepared[1] && (
          <SecondaryBars
            series={prepared[1]}
            x={x}
            y={yRight}
            plotWidth={plotWidth}
            baseline={secondaryBaseline}
            emphasizedSeriesId={config.emphasizedSeriesId}
          />
        )}

        {config.highlightDate && (
          <g className="date-highlight">
            <line
              x1={x(parseDate(config.highlightDate))}
              x2={x(parseDate(config.highlightDate))}
              y1={margin.top}
              y2={margin.top + plotHeight}
            />
          </g>
        )}
      </g>

      {referenceLine && (
        <text
          className="reference-line-label"
          x={margin.left + plotWidth - 10}
          y={y(referenceLine.value) - 13}
          textAnchor="end"
        >
          {referenceLine.label}
        </text>
      )}

      {config.showEndLabels && supportsEndLabels && endLabelSeries.length > 0 && (
        <EndLabels
          series={endLabelSeries}
          x={x}
          y={y}
          plotRight={margin.left + plotWidth}
          plotTop={margin.top}
          plotBottom={margin.top + plotHeight}
          emphasizedSeriesId={config.emphasizedSeriesId}
          transform={config.transform}
          indexed={config.chartType === 'indexed'}
          useLinePatterns={config.useLinePatterns}
        />
      )}

      <g className="axis x-axis">
        <line
          x1={margin.left}
          x2={margin.left + plotWidth}
          y1={margin.top + plotHeight}
          y2={margin.top + plotHeight}
        />
        {xTicks.map((tick) => (
          <g key={tick.toISOString()} transform={`translate(${x(tick)}, ${margin.top + plotHeight})`}>
            <line y2={12} />
            <text y={43} textAnchor="middle">
              {formatChartDate(tick, xDomain)}
            </text>
          </g>
        ))}
      </g>

      <g className="axis y-axis">
        <line
          x1={margin.left}
          x2={margin.left}
          y1={margin.top}
          y2={margin.top + plotHeight}
        />
        {yTicks.map((tick) => (
          <g key={tick} transform={`translate(${margin.left}, ${y(tick)})`}>
            <line x2={-12} />
            <text x={-24} dy="0.34em" textAnchor="end">
              {formatChartValue(tick, {
                units: primaryUnits,
                transform: config.transform,
                indexed: config.chartType === 'indexed',
                mode: 'axis',
              })}
            </text>
          </g>
        ))}
        <text
          className="axis-unit"
          x={margin.left}
          y={margin.top - 25}
          textAnchor="start"
        >
          {axisUnitLabel(primaryUnits, config.transform, config.chartType === 'indexed')}
        </text>
      </g>

      {config.chartType === 'dual-axis' && prepared[1] && (
        <g className="axis y-axis y-axis-right">
          <line
            x1={margin.left + plotWidth}
            x2={margin.left + plotWidth}
            y1={margin.top}
            y2={margin.top + plotHeight}
          />
          {yRightTicks.map((tick) => (
            <g
              key={tick}
              transform={`translate(${margin.left + plotWidth}, ${yRight(tick)})`}
            >
              <line x2={12} />
              <text x={24} dy="0.34em" textAnchor="start">
                {formatChartValue(tick, {
                  units: prepared[1].meta.units,
                  transform: config.transform,
                  mode: 'axis',
                })}
              </text>
            </g>
          ))}
          <text
            className="axis-unit"
            x={margin.left + plotWidth}
            y={margin.top - 25}
            textAnchor="end"
          >
            {axisUnitLabel(prepared[1].meta.units, config.transform, false)}
          </text>
        </g>
      )}

      {(config.note || config.highlightDate || config.highlightLabel) && (
        <AnnotationCallout
          note={config.note}
          label={config.highlightLabel}
          highlightDate={config.highlightDate}
          point={annotationPoint}
          x={x}
          y={annotationYScale}
          plotLeft={margin.left}
          plotRight={margin.left + plotWidth}
          plotTop={margin.top}
          plotBottom={margin.top + plotHeight}
          compact={compact}
        />
      )}

      <SourceFooter
        y={height - footerHeight}
        width={width}
        height={footerHeight}
        text={sourceFooter}
      />
    </svg>
  );
});

function ChartHeader({
  width,
  titleTop,
  compact,
  series,
}: {
  width: number;
  titleTop: number;
  compact: boolean;
  series: SeriesSelection[];
}) {
  const { state } = useChart();
  const titleSize = chartTitleSize(width);
  const subtitleSize = Math.max(25, Math.min(34, width / 60));
  const titleLines = wrapText(
    state.config.title,
    chartTitleCharactersPerLine(width, compact),
  );
  const titleLineHeight = titleSize * 1.04;
  const renderedTitleLines = Math.max(1, titleLines.length);
  return (
    <g className="chart-header">
      <text x={width * 0.065} y={titleTop} fontSize={titleSize}>
        {titleLines.map((lineText, index) => (
          <tspan key={`${lineText}-${index}`} x={width * 0.065} y={titleTop + index * titleLineHeight}>
            {lineText}
          </tspan>
        ))}
      </text>
      {state.config.subtitle && (
        <text
          className="chart-subtitle"
          x={width * 0.065}
          y={titleTop + (renderedTitleLines - 1) * titleLineHeight + titleSize * 0.95}
          fontSize={subtitleSize}
        >
          {truncate(state.config.subtitle, compact ? 55 : 125)}
        </text>
      )}
      {series.some((item) => item.loading) && (
        <text className="refresh-label" x={width * 0.935} y={titleTop} textAnchor="end">
          Refreshing data…
        </text>
      )}
    </g>
  );
}

function SeriesLine({
  series,
  seriesIndex,
  emphasizedSeriesId,
  useLinePatterns,
  x,
  y,
}: {
  series: PreparedSeries;
  seriesIndex: number;
  emphasizedSeriesId?: string;
  useLinePatterns: boolean;
  x: ScaleTime<number, number>;
  y: ScaleLinear<number, number>;
}) {
  const path = line<Point>()
    .defined((point) => point.value !== null)
    .x((point) => x(point.date))
    .y((point) => y(point.value!))
    .curve(curveMonotoneX)(series.points);
  if (!path) return null;
  return (
    <path
      className={seriesClassName('series-line', series.id, emphasizedSeriesId)}
      d={path}
      stroke={series.color}
      strokeDasharray={lineDashPattern(seriesIndex, useLinePatterns)}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function EndLabels({
  series,
  x,
  y,
  plotRight,
  plotTop,
  plotBottom,
  emphasizedSeriesId,
  transform,
  indexed,
  useLinePatterns,
}: {
  series: PreparedSeries[];
  x: ScaleTime<number, number>;
  y: ScaleLinear<number, number>;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  emphasizedSeriesId?: string;
  transform: Transform;
  indexed: boolean;
  useLinePatterns: boolean;
}) {
  const labels = layoutEndLabels(series, y, plotTop + 18, plotBottom - 18, 56);

  return (
    <g className="end-labels">
      {labels.map(({ series: item, point, seriesIndex, labelY }) => {
        const muted = Boolean(emphasizedSeriesId && emphasizedSeriesId !== item.id);
        const className = muted ? 'end-label is-muted' : 'end-label';
        const anchorX = x(point.date);
        const anchorY = y(point.value!);
        return (
          <g key={item.id} className={className}>
            <path
              className="end-label-leader"
              d={`M${anchorX},${anchorY} L${plotRight + 10},${anchorY} L${plotRight + 22},${labelY}`}
              stroke={item.color}
              strokeDasharray={lineDashPattern(seriesIndex, useLinePatterns)}
            />
            <circle cx={anchorX} cy={anchorY} r={6} fill={item.color} />
            <text x={plotRight + 34} y={labelY - 6}>
              <tspan className="end-label-name">{truncate(item.label, 25)}</tspan>
              <tspan className="end-label-value" x={plotRight + 34} dy={27}>
                {formatChartValue(point.value!, {
                  units: item.meta.units,
                  transform,
                  indexed,
                  mode: 'label',
                })}
              </tspan>
            </text>
          </g>
        );
      })}
    </g>
  );
}

function AnnotationCallout({
  note,
  label,
  highlightDate,
  point,
  x,
  y,
  plotLeft,
  plotRight,
  plotTop,
  plotBottom,
  compact,
}: {
  note?: string;
  label?: string;
  highlightDate?: string;
  point: Point | null;
  x: ScaleTime<number, number>;
  y: ScaleLinear<number, number>;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  compact: boolean;
}) {
  const requestedDate = highlightDate ? parseDate(highlightDate) : null;
  const anchorX = point ? x(point.date) : requestedDate ? x(requestedDate) : null;
  const anchorY = point ? y(point.value!) : requestedDate ? plotTop + (plotBottom - plotTop) * 0.48 : null;
  const boxWidth = Math.min(520, (plotRight - plotLeft) * (compact ? 0.5 : 0.4));
  const noteLines = note ? wrapText(note, compact ? 30 : 48, 3) : [];
  const boxHeight = 62 + Math.max(0, noteLines.length) * 30;
  const placeOnRight = anchorX == null || anchorX < (plotLeft + plotRight) / 2;
  const boxX = placeOnRight ? plotRight - boxWidth - 20 : plotLeft + 20;
  const boxY = plotTop + 24;
  const heading =
    label?.trim() || (requestedDate ? formatAnnotationDate(requestedDate) : 'Chart note');
  const connectorX = placeOnRight ? boxX : boxX + boxWidth;
  const connectorY = Math.min(boxY + boxHeight - 24, boxY + 46);

  return (
    <g className="chart-callout">
      {anchorX != null && anchorY != null && (
        <>
          <path
            className="callout-leader"
            d={`M${anchorX},${anchorY} L${anchorX},${connectorY} L${connectorX},${connectorY}`}
          />
          <circle className="callout-anchor" cx={anchorX} cy={anchorY} r={7} />
        </>
      )}
      <g transform={`translate(${boxX}, ${boxY})`}>
        <rect width={boxWidth} height={boxHeight} rx={7} />
        <text className="callout-heading" x={24} y={34}>
          {truncate(heading, compact ? 30 : 46)}
        </text>
        {noteLines.length > 0 && (
          <text className="callout-body" x={24} y={68}>
            {noteLines.map((lineText, index) => (
              <tspan key={`${lineText}-${index}`} x={24} dy={index === 0 ? 0 : 30}>
                {lineText}
              </tspan>
            ))}
          </text>
        )}
      </g>
    </g>
  );
}

function GroupedBars({
  series,
  x,
  y,
  plotWidth,
  baseline,
  emphasizedSeriesId,
}: {
  series: PreparedSeries[];
  x: ScaleTime<number, number>;
  y: ScaleLinear<number, number>;
  plotWidth: number;
  baseline: number;
  emphasizedSeriesId?: string;
}) {
  const dateKeys = [
    ...new Set(series.flatMap((item) => item.points.map((point) => point.dateKey))),
  ].sort();
  const outerWidth = Math.max(3, Math.min(70, (plotWidth / Math.max(dateKeys.length, 1)) * 0.8));
  const inner = scaleBand<string>()
    .domain(series.map((item) => item.id))
    .range([-outerWidth / 2, outerWidth / 2])
    .padding(0.12);

  return series.flatMap((item) =>
    item.points.map((point) => {
      if (point.value === null) return null;
      const yValue = y(point.value);
      return (
        <rect
          key={`${item.id}-${point.dateKey}`}
          x={x(point.date) + (inner(item.id) ?? 0)}
          y={Math.min(baseline, yValue)}
          width={Math.max(1, inner.bandwidth())}
          height={Math.abs(baseline - yValue)}
          fill={item.color}
          className={seriesClassName('series-bar', item.id, emphasizedSeriesId)}
        />
      );
    }),
  );
}

function SecondaryBars({
  series,
  x,
  y,
  plotWidth,
  baseline,
  emphasizedSeriesId,
}: {
  series: PreparedSeries;
  x: ScaleTime<number, number>;
  y: ScaleLinear<number, number>;
  plotWidth: number;
  baseline: number;
  emphasizedSeriesId?: string;
}) {
  const barWidth = Math.max(4, Math.min(42, (plotWidth / Math.max(series.points.length, 1)) * 0.7));
  return series.points.map((point) => {
    if (point.value === null) return null;
    const yValue = y(point.value);
    return (
      <rect
        key={point.dateKey}
        x={x(point.date) - barWidth / 2}
        y={Math.min(baseline, yValue)}
        width={barWidth}
        height={Math.abs(baseline - yValue)}
        fill={series.color}
        className={seriesClassName('series-bar dual-bar', series.id, emphasizedSeriesId)}
      />
    );
  });
}

interface SnapshotProps {
  width: number;
  height: number;
  margin: { left: number; right: number; top: number; bottom: number };
  plotWidth: number;
  plotHeight: number;
  series: PreparedSeries[];
  sourceFooter: string;
}

const SnapshotChart = forwardRef<SVGSVGElement, SnapshotProps>(function SnapshotChart(
  { width, height, margin, plotWidth, plotHeight, series, sourceFooter },
  ref,
) {
  const { state } = useChart();
  const footerHeight = Math.max(84, height * 0.075);
  const referenceLine = state.config.showReferenceLine
    ? referenceLineFor('snapshot-ranking', state.config.transform)
    : null;
  const ranked = series
    .map((item) => {
      const point = [...item.points].reverse().find((candidate) => candidate.value !== null);
      return point ? { ...item, latest: point.value!, latestDate: point.dateKey } : null;
    })
    .filter((item): item is PreparedSeries & { latest: number; latestDate: string } => item !== null)
    .sort((a, b) => b.latest - a.latest);
  const valueExtent = extent(ranked, (item) => item.latest);
  const minimum = Math.min(0, valueExtent[0] ?? 0);
  const maximum = Math.max(0, valueExtent[1] ?? 1);
  const x = scaleLinear()
    .domain(paddedDomain([minimum, maximum], true))
    .nice()
    .range([margin.left, margin.left + plotWidth]);
  const y = scaleBand<string>()
    .domain(ranked.map((item) => item.id))
    .range([margin.top, margin.top + plotHeight])
    .padding(0.28);
  const zero = x(0);
  const units = commonUnits(series);

  return (
    <svg
      ref={ref}
      className="chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={state.config.title}
      style={{
        background: brand.colors.background,
        fontFamily: 'var(--brand-font)',
      }}
    >
      <rect width={width} height={height} fill={brand.colors.background} />
      <ChartHeader
        width={width}
        titleTop={Math.max(68, height * 0.06)}
        compact={width / height < 1.15}
        series={series}
      />
      {x.ticks(6).map((tick) => (
        <g key={tick}>
          {state.config.showGridlines && (
            <line
              className="gridline"
              x1={x(tick)}
              x2={x(tick)}
              y1={margin.top}
              y2={margin.top + plotHeight}
            />
          )}
          <text
            className="snapshot-tick"
            x={x(tick)}
            y={margin.top + plotHeight + 50}
            textAnchor="middle"
          >
            {formatChartValue(tick, {
              units,
              transform: state.config.transform,
              mode: 'axis',
            })}
          </text>
        </g>
      ))}
      <line
        className={referenceLine ? 'reference-line' : 'zero-line'}
        x1={zero}
        x2={zero}
        y1={margin.top}
        y2={margin.top + plotHeight}
      />
      {referenceLine && (
        <text
          className="reference-line-label"
          x={zero + 12}
          y={margin.top + 22}
          textAnchor="start"
        >
          {referenceLine.label}
        </text>
      )}
      {ranked.map((item) => {
        const barStart = Math.min(zero, x(item.latest));
        return (
          <g key={item.id}>
            <text
              className={seriesClassName(
                'snapshot-label',
                item.id,
                state.config.emphasizedSeriesId,
              )}
              x={margin.left - 28}
              y={(y(item.id) ?? 0) + y.bandwidth() / 2}
              dy="0.35em"
              textAnchor="end"
            >
              {truncate(item.label, 30)}
            </text>
            <rect
              className={seriesClassName(
                'snapshot-bar',
                item.id,
                state.config.emphasizedSeriesId,
              )}
              x={barStart}
              y={y(item.id)}
              width={Math.abs(x(item.latest) - zero)}
              height={y.bandwidth()}
              fill={item.color}
              rx={3}
            />
            <text
              className={seriesClassName(
                'snapshot-value',
                item.id,
                state.config.emphasizedSeriesId,
              )}
              x={item.latest >= 0 ? x(item.latest) + 20 : x(item.latest) - 20}
              y={(y(item.id) ?? 0) + y.bandwidth() / 2}
              dy="0.35em"
              textAnchor={item.latest >= 0 ? 'start' : 'end'}
            >
              {formatChartValue(item.latest, {
                units: item.meta.units,
                transform: state.config.transform,
                mode: 'label',
              })}
            </text>
          </g>
        );
      })}
      <text
        className="snapshot-date"
        x={margin.left}
        y={margin.top - 30}
      >
        Latest available observation for each series
      </text>
      <SourceFooter
        y={height - footerHeight}
        width={width}
        height={footerHeight}
        text={sourceFooter}
      />
    </svg>
  );
});

function Legend({
  series,
  position,
  x,
  y,
  availableWidth,
  emphasizedSeriesId,
  useLinePatterns,
}: {
  series: SeriesSelection[];
  position: 'top' | 'right';
  x: number;
  y: number;
  availableWidth: number;
  emphasizedSeriesId?: string;
  useLinePatterns: boolean;
}) {
  if (position === 'right') {
    return (
      <g className="chart-legend">
        {series.map((item, index) => (
          <g
            key={item.id}
            className={seriesClassName('legend-item', item.id, emphasizedSeriesId)}
            transform={`translate(${x}, ${y + index * 54})`}
          >
            <line
              x1={0}
              x2={35}
              y1={0}
              y2={0}
              stroke={item.color}
              strokeDasharray={lineDashPattern(index, useLinePatterns)}
            />
            <text x={52} y={0} dy="0.35em">
              {truncate(item.label, 26)}
            </text>
          </g>
        ))}
      </g>
    );
  }

  let cursor = 0;
  return (
    <g className="chart-legend" transform={`translate(${x}, ${y})`}>
      {series.map((item, index) => {
        const itemWidth = Math.min(availableWidth, 75 + item.label.length * 17);
        const current = cursor;
        cursor += itemWidth;
        return (
          <g
            key={item.id}
            className={seriesClassName('legend-item', item.id, emphasizedSeriesId)}
            transform={`translate(${current}, 0)`}
          >
            <line
              x1={0}
              x2={35}
              y1={0}
              y2={0}
              stroke={item.color}
              strokeDasharray={lineDashPattern(index, useLinePatterns)}
            />
            <text x={52} y={0} dy="0.35em">
              {truncate(item.label, 28)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function SourceFooter({
  y,
  width,
  height,
  text,
}: {
  y: number;
  width: number;
  height: number;
  text: string;
}) {
  return (
    <g className="source-footer">
      <rect x={0} y={y} width={width} height={height} />
      <text x={width * 0.065} y={y + height / 2} dy="0.35em">
        {truncate(text, Math.max(100, Math.floor(width / 14)))}
      </text>
      <text
        className="footer-mark"
        x={width * 0.935}
        y={y + height / 2}
        dy="0.35em"
        textAnchor="end"
      >
        FRED CHART STUDIO
      </text>
    </g>
  );
}

function preparePoints(series: SeriesSelection, indexed: boolean): Point[] {
  const points = series.observations.map((observation) => ({
    date: parseDate(observation.date),
    dateKey: observation.date,
    value: observation.value,
  }));
  if (!indexed) return points;
  const base = points.find((point) => point.value !== null && point.value !== 0)?.value;
  if (base == null) return points;
  return points.map((point) => ({
    ...point,
    value: point.value === null ? null : (point.value / base) * 100,
  }));
}

function paddedDomain(values: number[], includeZero = false): [number, number] {
  if (!values.length) return includeZero ? [0, 1] : [0, 100];
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (includeZero) {
    low = Math.min(0, low);
    high = Math.max(0, high);
  }
  if (low === high) {
    const padding = Math.abs(low || 1) * 0.1;
    return [low - padding, high + padding];
  }
  const padding = (high - low) * 0.08;
  return [low - padding, high + padding];
}

function baselineForDomain(domain: number[]): number {
  const [low = 0, high = 1] = domain;
  if (low <= 0 && high >= 0) return 0;
  return low > 0 ? low : high;
}

function commonUnits(series: PreparedSeries[]): string | undefined {
  const units = [...new Set(series.map((item) => item.meta.units))];
  return units.length === 1 ? units[0] : undefined;
}

function buildSourceFooter(series: SeriesSelection[]): string {
  if (!series.length) return 'Source: FRED, Federal Reserve Bank of St. Louis.';
  const sources = [...new Set(series.map((item) => item.meta.sourceName))].join('; ');
  const ids = series.map((item) => item.id).join(', ');
  const updated = max(
    series
      .map((item) => item.meta.lastUpdated)
      .filter(Boolean)
      .map((value) => new Date(value.replace(' ', 'T'))),
  );
  const updatedLabel = updated
    ? updated.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'latest available';
  return `Source: FRED, ${sources}, series ${ids}, data as of ${updatedLabel}.`;
}

function getRecessionIntervals(observations: Observation[], domainEnd: Date) {
  const intervals: Array<{ start: Date; end: Date }> = [];
  let start: Date | null = null;

  observations.forEach((observation, index) => {
    if (observation.value === 1 && !start) start = parseDate(observation.date);
    const next = observations[index + 1];
    if (start && (observation.value !== 1 || !next)) {
      const end =
        observation.value !== 1
          ? parseDate(observation.date)
          : next
            ? parseDate(next.date)
            : domainEnd;
      intervals.push({ start, end });
      start = null;
    }
  });
  return intervals;
}

function wrapText(text: string, maxCharacters: number, maxLines = 2): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let lineText = '';
  words.forEach((word) => {
    const candidate = lineText ? `${lineText} ${word}` : word;
    if (candidate.length > maxCharacters && lineText) {
      lines.push(lineText);
      lineText = word;
    } else {
      lineText = candidate;
    }
  });
  if (lineText) lines.push(lineText);
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > visibleLines.length && visibleLines.length) {
    const finalIndex = visibleLines.length - 1;
    visibleLines[finalIndex] = `${visibleLines[finalIndex].replace(/…$/, '').trimEnd()}…`;
  }
  return visibleLines;
}

function chartTitleSize(width: number): number {
  return Math.max(40, Math.min(66, width / 35));
}

function chartTitleCharactersPerLine(width: number, compact: boolean): number {
  const estimatedCharacters = Math.floor((width * 0.87) / (chartTitleSize(width) * 0.55));
  return Math.max(30, Math.min(compact ? 48 : 68, estimatedCharacters));
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 1)).trim()}…`;
}

function seriesClassName(
  baseClass: string,
  seriesId: string,
  emphasizedSeriesId?: string,
): string {
  if (!emphasizedSeriesId) return baseClass;
  return `${baseClass} ${seriesId === emphasizedSeriesId ? 'is-emphasized' : 'is-muted'}`;
}

function nearestPoint(points: Point[], target: Date): Point | null {
  const candidates = points.filter(
    (point): point is Point & { value: number } => point.value !== null,
  );
  if (!candidates.length) return null;
  return candidates.reduce((nearest, point) =>
    Math.abs(+point.date - +target) < Math.abs(+nearest.date - +target) ? point : nearest,
  );
}

function layoutEndLabels(
  series: PreparedSeries[],
  y: ScaleLinear<number, number>,
  top: number,
  bottom: number,
  minimumGap: number,
) {
  const labels = series
    .map((item, seriesIndex) => {
      const point = [...item.points].reverse().find((candidate) => candidate.value !== null);
      return point
        ? { series: item, seriesIndex, point, desiredY: y(point.value!), labelY: y(point.value!) }
        : null;
    })
    .filter(
      (
        item,
      ): item is {
        series: PreparedSeries;
        seriesIndex: number;
        point: Point;
        desiredY: number;
        labelY: number;
      } => item !== null,
    )
    .sort((first, second) => first.desiredY - second.desiredY);

  let cursor = top;
  labels.forEach((label) => {
    label.labelY = Math.max(label.desiredY, cursor);
    cursor = label.labelY + minimumGap;
  });

  const overflow = labels.length ? labels[labels.length - 1].labelY - bottom : 0;
  if (overflow > 0) {
    labels.forEach((label) => {
      label.labelY -= overflow;
    });
    for (let index = labels.length - 2; index >= 0; index -= 1) {
      labels[index].labelY = Math.min(
        labels[index].labelY,
        labels[index + 1].labelY - minimumGap,
      );
    }
  }

  return labels;
}
