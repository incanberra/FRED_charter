import assert from 'node:assert/strict';
import test from 'node:test';
import {
  axisUnitLabel,
  formatChartDate,
  formatChartValue,
  lineDashPattern,
  referenceLineFor,
} from '../src/lib/chartFormatting.ts';

test('smart value formatting reflects units and transforms', () => {
  assert.equal(formatChartValue(4.25, { units: 'Percent', transform: 'lin' }), '4.3%');
  assert.equal(formatChartValue(-2.14, { units: 'Index', transform: 'pc1' }), '−2.1%');
  assert.equal(formatChartValue(108.4, { units: 'Percent', transform: 'lin', indexed: true }), '108.4');
  assert.equal(formatChartValue(2_450_000_000, { units: 'Persons', transform: 'lin', mode: 'axis' }), '2.5B');
  assert.equal(formatChartValue(27_360, { units: 'Billions of Dollars', transform: 'lin' }), '$27,360');
});

test('axis labels explain transformed data', () => {
  assert.equal(axisUnitLabel('Percent', 'pc1', false), 'Percent change from year ago');
  assert.equal(axisUnitLabel('Index', 'lin', true), 'Index · first visible observation = 100');
});

test('reference lines follow chart semantics', () => {
  assert.deepEqual(referenceLineFor('indexed', 'lin'), { value: 100, label: 'Index baseline · 100' });
  assert.deepEqual(referenceLineFor('line', 'pch'), { value: 0, label: 'No change · 0' });
  assert.equal(referenceLineFor('line', 'lin'), null);
});

test('date formatting adapts to the visible range', () => {
  const date = new Date('2026-02-05T00:00:00');
  assert.equal(formatChartDate(date, [new Date('2026-01-01'), new Date('2026-03-01')]), '5 Feb');
  assert.equal(formatChartDate(date, [new Date('2025-01-01'), new Date('2026-03-01')]), 'Feb 2026');
  assert.equal(formatChartDate(date, [new Date('2016-01-01'), new Date('2026-03-01')]), '2026');
});

test('line patterns add non-colour differentiation', () => {
  assert.equal(lineDashPattern(0, true), undefined);
  assert.equal(lineDashPattern(1, true), '16 8');
  assert.equal(lineDashPattern(4, false), undefined);
});
