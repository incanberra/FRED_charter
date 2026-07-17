import assert from 'node:assert/strict';
import test from 'node:test';
import { brand, chartSeriesColors, createBrandRamp } from '../src/brand.ts';

test('chart palette starts with the high-differentiation teal and copper pair', () => {
  assert.deepEqual(createBrandRamp(2), ['#176C68', '#A95D2F']);
  assert.deepEqual(createBrandRamp(8), [...chartSeriesColors]);
});

test('chart palette colors meet non-text contrast against the canvas', () => {
  for (const color of chartSeriesColors) {
    assert.ok(
      contrastRatio(color, brand.colors.background) >= 3,
      `${color} must have at least 3:1 contrast against ${brand.colors.background}`,
    );
  }
});

test('interface text colors meet WCAG AA contrast against the canvas', () => {
  for (const color of [
    brand.colors.primary,
    brand.colors.secondary,
    brand.colors.accent,
    brand.colors.neutral,
  ]) {
    assert.ok(
      contrastRatio(color, brand.colors.background) >= 4.5,
      `${color} must have at least 4.5:1 contrast against ${brand.colors.background}`,
    );
  }
});

test('extended palette creates distinct variants beyond eight series', () => {
  const colors = createBrandRamp(12);
  assert.equal(colors.length, 12);
  assert.equal(new Set(colors).size, 12);
});

function contrastRatio(first, second) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

function luminance(hex) {
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
