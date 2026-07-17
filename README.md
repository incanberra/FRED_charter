# FRED Chart Studio

A single-user React/D3 chart-building tool for turning FRED series into branded JPGs.

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and add a FRED API key:

   ```text
   FRED_API_KEY=your_key_here
   ```

3. Run the frontend and Netlify Function together:

   ```powershell
   npm run netlify:dev
   ```

Use the URL printed by Netlify CLI. Running `npm run dev` alone serves the interface but does not provide the FRED proxy.

If the app reports that the API key is missing, stop every existing local server with
`Ctrl+C`, then verify the complete local proxy path:

```powershell
npm run verify:fred
```

The command starts a temporary Netlify Dev server, requests the `UNRATE` series through
the proxy, and shuts the server down. It never prints the API key.

## Deploy to Netlify

Netlify hosts both parts of the app: the static Vite frontend and the FRED proxy
Function. No second hosting service is required.

1. Push the repository to GitHub or another Git provider.
2. In Netlify, choose **Add new site → Import an existing project** and select the
   repository.
3. Netlify reads the committed `netlify.toml`, which configures:

   ```text
   Build command: npm run build
   Publish directory: dist
   Functions directory: netlify/functions
   ```

4. In **Site configuration → Environment variables**, add:

   ```text
   FRED_API_KEY=your_actual_fred_api_key
   ```

5. Trigger the deployment, then open the generated `netlify.app` URL.

The frontend calls only `/.netlify/functions/fred`. The FRED API key remains in
Netlify's server environment and never appears in the browser bundle or Git history.

## Architecture notes

- The chart preview is one inline SVG rendered with D3 scales, paths, and layout calculations.
- JPG export clones and serialises that exact SVG, waits for `document.fonts.ready`, paints the background, and rasterises at the requested density.
- Presets store series IDs, labels, colours, chart configuration, and export settings in `localStorage`. Observations are always fetched again when a preset is loaded.
- The corporate typeface can be changed through `--brand-font` in `src/styles.css`.
- The quick-access series list is in `src/config/quickAccess.ts`.

## Checks

```powershell
npm run typecheck
npm run build
```
