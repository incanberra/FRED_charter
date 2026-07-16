import type { TimeframePreset } from '../types';

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function rangeForPreset(
  preset: TimeframePreset,
  current?: { start: string; end: string },
): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);

  if (preset === '1Y') start.setFullYear(end.getFullYear() - 1);
  if (preset === '5Y') start.setFullYear(end.getFullYear() - 5);
  if (preset === '10Y') start.setFullYear(end.getFullYear() - 10);
  if (preset === 'max') return { start: '', end: isoDate(end) };
  if (preset === 'custom' && current) return current;

  return { start: isoDate(start), end: isoDate(end) };
}

export function todayStamp(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}
