import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const cliPath = path.join(projectRoot, 'node_modules', 'netlify-cli', 'bin', 'run.js');
const port = 8899;
const output = [];

const child = spawn(
  process.execPath,
  [cliPath, 'dev', '--offline', '--port', String(port), '--no-open'],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
);

child.stdout.on('data', (chunk) => output.push(chunk.toString()));
child.stderr.on('data', (chunk) => output.push(chunk.toString()));

try {
  const metadataResponse = await waitForResponse(
    `http://127.0.0.1:${port}/.netlify/functions/fred?endpoint=series&series_id=UNRATE`,
  );
  const metadataBody = await metadataResponse.json();

  if (!metadataResponse.ok) {
    throw new Error(
      metadataBody.error ??
        metadataBody.error_message ??
        `HTTP ${metadataResponse.status}`,
    );
  }

  const searchResponse = await fetch(
    `http://127.0.0.1:${port}/.netlify/functions/fred?endpoint=series%2Fsearch&search_text=inflation&limit=1`,
  );
  const searchBody = await searchResponse.json();
  if (!searchResponse.ok) {
    throw new Error(
      searchBody.error ?? searchBody.error_message ?? `HTTP ${searchResponse.status}`,
    );
  }

  console.log(
    JSON.stringify({
      statusCode: metadataResponse.status,
      seriesId: metadataBody.seriess?.[0]?.id,
      title: metadataBody.seriess?.[0]?.title,
      searchStatusCode: searchResponse.status,
      searchResult: searchBody.seriess?.[0]?.id,
      envLoaded: output.join('').includes('FRED_API_KEY'),
    }),
  );
} catch (error) {
  const safeLog = output
    .join('')
    .split(/\r?\n/)
    .filter((line) => /FRED_API_KEY|Injected|error|failed/i.test(line))
    .join('\n');
  console.error(error instanceof Error ? error.message : error);
  if (safeLog) console.error(safeLog);
  process.exitCode = 1;
} finally {
  stopProcessTree(child.pid);
}

async function waitForResponse(url) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Netlify Dev did not start within 30 seconds.');
}

function stopProcessTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    child.kill('SIGTERM');
  }
}
