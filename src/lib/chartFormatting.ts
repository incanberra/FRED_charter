import type { ChartType, Transform } from '../types';

export interface ValueFormatOptions {
  units?: string;
  transform: Transform;
  indexed?: boolean;
  mode?: 'axis' | 'label';
}

export interface ReferenceLine {
  value: number;
  label: string;
}

const scaledUnitPattern = /\b(thousand|million|billion|trillion)s?\b/i;
const currencyPattern = /\b(dollars?|usd|currency)\b/i;
const percentPattern = /\b(percent|percentage points?)\b|%/i;

export function formatChartValue(value: number, options: ValueFormatOptions): string {
  if (!Number.isFinite(value)) return '—';

  const units = options.units ?? '';
  const isPercent =
    !options.indexed &&
    (options.transform === 'pc1' ||
      options.transform === 'pch' ||
      percentPattern.test(units));
  const isCurrency = !options.indexed && currencyPattern.test(units) && !isPercent;
  const unitsAlreadyScaled = scaledUnitPattern.test(units);
  const absolute = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const prefix = isCurrency ? '$' : '';

  let displayValue = absolute;
  let suffix = '';
  if (!unitsAlreadyScaled && !isPercent) {
    if (absolute >= 1_000_000_000_000) {
      displayValue = absolute / 1_000_000_000_000;
      suffix = options.mode === 'axis' ? 'T' : 'tn';
    } else if (absolute >= 1_000_000_000) {
      displayValue = absolute / 1_000_000_000;
      suffix = options.mode === 'axis' ? 'B' : 'bn';
    } else if (absolute >= 1_000_000) {
      displayValue = absolute / 1_000_000;
      suffix = options.mode === 'axis' ? 'M' : 'm';
    } else if (absolute >= 10_000) {
      displayValue = absolute / 1_000;
      suffix = 'k';
    }
  }

  const maximumFractionDigits = options.indexed
    ? 1
    : displayValue >= 100
      ? 0
      : displayValue >= 10
        ? 1
        : displayValue >= 1
          ? 1
          : 2;
  const formatted = new Intl.NumberFormat('en-AU', {
    maximumFractionDigits,
    useGrouping: true,
  }).format(displayValue);

  return `${sign}${prefix}${formatted}${suffix}${isPercent ? '%' : ''}`;
}

export function axisUnitLabel(
  units: string | undefined,
  transform: Transform,
  indexed: boolean,
): string {
  if (indexed) return 'Index · first visible observation = 100';
  if (transform === 'pc1') return 'Percent change from year ago';
  if (transform === 'pch') return 'Percent change from previous period';
  if (transform === 'chg') return units ? `Change · ${units}` : 'Change';
  return units || 'Value';
}

export function referenceLineFor(chartType: ChartType, transform: Transform): ReferenceLine | null {
  if (chartType === 'indexed') return { value: 100, label: 'Index baseline · 100' };
  if (transform !== 'lin') return { value: 0, label: 'No change · 0' };
  return null;
}

export function formatChartDate(date: Date, domain: [Date, Date]): string {
  const spanDays = (+domain[1] - +domain[0]) / 86_400_000;
  if (spanDays < 120) {
    return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(date);
  }
  if (spanDays < 730) {
    return new Intl.DateTimeFormat('en-AU', { month: 'short', year: 'numeric' }).format(date);
  }
  if (spanDays < 2_200) {
    return new Intl.DateTimeFormat('en-AU', { month: 'short', year: 'numeric' }).format(date);
  }
  return new Intl.DateTimeFormat('en-AU', { year: 'numeric' }).format(date);
}

export function formatAnnotationDate(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function lineDashPattern(seriesIndex: number, enabled: boolean): string | undefined {
  if (!enabled || seriesIndex === 0) return undefined;
  return ['16 8', '3 7', '18 7 4 7', '2 9', '12 6 2 6', '22 8'][(seriesIndex - 1) % 6];
}
