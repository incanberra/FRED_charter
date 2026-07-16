import { interpolateHsl } from 'd3';

export const brand = {
  colors: {
    primary: '#122B3B',
    secondary: '#236B6B',
    accent: '#67A3A3',
    neutral: '#AAB5B5',
    background: '#F6F8F7',
    white: '#FFFFFF',
    danger: '#A54848',
  },
};

export function createBrandRamp(count: number): string[] {
  if (count <= 1) return [brand.colors.secondary];

  const firstLeg = interpolateHsl(brand.colors.primary, brand.colors.secondary);
  const secondLeg = interpolateHsl(brand.colors.secondary, brand.colors.accent);

  return Array.from({ length: count }, (_, index) => {
    const position = index / (count - 1);
    return position <= 0.5
      ? firstLeg(position * 2)
      : secondLeg((position - 0.5) * 2);
  });
}
