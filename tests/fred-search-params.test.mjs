import assert from 'node:assert/strict';
import test from 'node:test';
import { searchGeographyTags, searchSeries } from '../src/lib/fred.ts';

test('series search uses FRED search_text parameter', async () => {
  const requestUrl = await captureRequest(() => searchSeries('inflation', ['japan']));
  const url = new URL(requestUrl, 'http://localhost');

  assert.equal(url.searchParams.get('endpoint'), 'series/search');
  assert.equal(url.searchParams.get('search_text'), 'inflation');
  assert.equal(url.searchParams.get('series_search_text'), null);
  assert.equal(url.searchParams.get('tag_names'), 'japan');
});

test('series search tags retains FRED series_search_text parameter', async () => {
  const requestUrl = await captureRequest(() => searchGeographyTags('inflation'));
  const url = new URL(requestUrl, 'http://localhost');

  assert.equal(url.searchParams.get('endpoint'), 'series/search/tags');
  assert.equal(url.searchParams.get('series_search_text'), 'inflation');
  assert.equal(url.searchParams.get('search_text'), null);
  assert.equal(url.searchParams.get('tag_group_id'), 'geo');
});

async function captureRequest(run) {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';

  globalThis.fetch = async (url) => {
    requestUrl = String(url);
    return new Response(JSON.stringify({ seriess: [], tags: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    await run();
    return requestUrl;
  } finally {
    globalThis.fetch = originalFetch;
  }
}
