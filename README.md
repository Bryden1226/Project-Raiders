# Raider Companion — GitHub Pages build

Upload the **contents of this folder** to the root of your GitHub Pages repository.

## Included

- Mobile-first, installable PWA shell
- Local inventory tracking
- Workbench and Scrappy upgrade tracking
- Expedition 3 and 4 tracking
- 82 blueprint collection entries
- Optimized blueprint artwork extracted from the supplied screenshots
- Material detail pages generated from every known usage
- Search, filters, completion statistics, offline caching, and JSON backup

## Data status

- Blueprint recipes marked `recipeVerified: true` were transcribed from supplied screenshots.
- Entries marked `recipeVerified: false` are present with artwork, but their recipe still needs verification.
- Material rarity, item category, stack size, weight, sell value, and description are left explicitly unverified. The public items page loads these details dynamically and did not expose them in the accessible page response.

## Structure

```
index.html
manifest.webmanifest
service-worker.js
assets/
  css/app.css
  js/app.js
  icons/
  blueprints/
data/
  materials.json
  blueprints.json
  upgrades.json
  expeditions.json
```

## Updating data

Edit JSON files under `/data`. Keep IDs stable so users do not lose locally stored progress.

## Local testing

A service worker requires HTTP rather than opening the HTML file directly. Run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Version 4: Items Encyclopedia

The former Inventory tab is now **Items**. It loads the complete community item dataset through the ARC Raiders Data API, which mirrors the open RaidTheory dataset used by ARCTracker.io.

- Source data: RaidTheory/arcraiders-data
- Reference site: ARCTracker.io
- API mirror: Mahcks/arcraiders-data-api

The encyclopedia loads in paginated batches and falls back to the locally bundled progression-material list if the external data source is temporarily unavailable.
