import type { Handler } from '@netlify/functions';

const ALLOWED_ENDPOINTS = new Set([
  'series/search',
  'series/search/tags',
  'series/observations',
  'category',
  'category/children',
  'category/series',
  'series',
]);

const FRED_API_ROOT = 'https://api.stlouisfed.org/fred';

export const handler: Handler = async (event) => {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return json(500, { error: 'FRED_API_KEY is not configured on the server.' });
  }

  const endpoint = event.queryStringParameters?.endpoint;
  if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
    return json(400, { error: 'Unsupported FRED endpoint.' });
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(event.queryStringParameters ?? {})) {
    if (key !== 'endpoint' && value != null) params.set(key, value);
  }
  params.set('api_key', apiKey);
  params.set('file_type', 'json');

  try {
    const response = await fetch(`${FRED_API_ROOT}/${endpoint}?${params.toString()}`);
    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
      body,
    };
  } catch (error) {
    return json(502, {
      error: 'Unable to reach FRED.',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

function json(statusCode: number, payload: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}
