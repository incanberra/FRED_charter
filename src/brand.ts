import { hsl } from 'd3';

export const brand = {
  colors: {
    primary: '#142A3A',
    secondary: '#176C68',
    accent: '#A95D2F',
    neutral: '#667377',
    grid: '#CDD4D1',
    border: '#D8DDD9',
    background: '#F7F6F2',
    surface: '#FFFFFF',
    white: '#FFFFFF',
    danger: '#A54848',
  },
};

export const chartSeriesColors = [
  '#176C68', // mineral teal
  '#A95D2F', // burnished copper
  '#3F5F78', // steel blue
  '#874D5F', // aubergine
  '#687A46', // olive
  '#377A96', // ocean blue
  '#765D80', // muted violet
  '#6A625A', // warm charcoal
] as const;

export function createBrandRamp(count: number): string[] {
  if (count <= 0) return [];
  if (count <= chartSeriesColors.length) return chartSeriesColors.slice(0, count);

  return Array.from({ length: count }, (_, index) => {
    const base = chartSeriesColors[index % chartSeriesColors.length];
    const cycle = Math.floor(index / chartSeriesColors.length);
    if (cycle === 0) return base;

    const variant = hsl(base);
    variant.l = Math.max(0.24, variant.l - cycle * 0.07);
    return variant.formatHex().toUpperCase();
  });
}
