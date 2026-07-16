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

## Production

Set `FRED_API_KEY` in the Netlify site's environment variables, then deploy. The frontend calls only `/.netlify/functions/fred`; the API key and upstream FRED URL are not included in the browser bundle.

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
