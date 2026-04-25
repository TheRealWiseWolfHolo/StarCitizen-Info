# StarCitizen-Info

Public Star Citizen ship data feeds generated from the live RSI pledge ship listing, StarCitizen.tools pledge vehicle metadata, and SPViewer ship detail pages.

## What It Publishes

- `ships.json`
  - JSON feed your mobile app can fetch directly
- `ship-details.json`
  - detailed ship metadata that keeps size, crew, status, and pledge availability from the StarCitizen.tools pledge vehicle list while sourcing component and weapon loadouts from SPViewer
- `resource-manifest.json`
  - map of mirrored ship media published by the feed
- `index.html`
  - Human-friendly browser view of the same data
- `media/ships/*`
  - mirrored ship images served from GitHub Pages instead of RSI
- `media/manufacturers/*`
  - published manufacturer logo assets used by the JSON feeds

The feed is built from:

- source page:
  - `https://robertsspaceindustries.com/en/pledge/ships?sale=true&sale=false&sortField=name&sortDirection=asc`
- source GraphQL endpoint:
  - `https://robertsspaceindustries.com/graphql`
- source ship detail pages:
  - `https://starcitizen.tools/List_of_pledge_vehicles`
- source component and weapon detail pages:
  - `https://www.spviewer.eu/`

## Credits And Data Attribution

- [SPViewer](https://www.spviewer.eu/) provides the ship performance/detail data used by `docs/ship-details.json`.
- SPViewer-backed fields include `description`, `technicalSections`, `specificationSections`, `componentEntries`, `weaponsUtilityEntries`, `componentSummary`, `weaponsUtilitySummary`, `spviewerId`, `spviewerName`, and `spviewerPageUrl`.
- StarCitizen.tools provides the pledge vehicle list metadata preserved in `docs/ship-details.json`, including ship names, source page URLs, manufacturer names, size, crew, in-game status, and pledge availability.
- RSI provides the pledge ship listing, MSRP data, production status, and source ship media mirrored by `docs/ships.json`.

## JSON Shape

`docs/ships.json` looks like this:

```json
{
  "generatedAt": "2026-04-18T21:00:00.000Z",
  "count": 250,
  "summary": {
    "purchasableCount": 120,
    "unavailableCount": 130
  },
  "manufacturers": [
    {
      "slug": "origin-jumpworks",
      "name": "Origin Jumpworks",
      "logos": {
        "default": {
          "path": "media/manufacturers/origin-jumpworks/black.png",
          "primaryUrl": "https://starcitizen-info.pages.dev/media/manufacturers/origin-jumpworks/black.png",
          "fallbackUrl": "https://therealwisewolfholo.github.io/StarCitizen-Info/media/manufacturers/origin-jumpworks/black.png"
        }
      }
    }
  ],
  "ships": [
    {
      "id": "159",
      "name": "100i",
      "manufacturer": "Origin Jumpworks",
      "manufacturerSlug": "origin-jumpworks",
      "msrpCentsUsd": 5000,
      "msrpUsd": 50,
      "purchasable": true,
      "productionStatus": "flight-ready",
      "thumbnailUrl": "https://therealwisewolfholo.github.io/StarCitizen-Info/media/ships/....webp",
      "sourceThumbnailUrl": "https://robertsspaceindustries.com/i/..."
    }
  ]
}
```

`docs/ship-details.json` adds SPViewer-backed ship specifications while preserving list-source metadata:

```json
{
  "generatedAt": "2026-04-23T00:00:00.000Z",
  "sourcePageUrl": "https://starcitizen.tools/List_of_pledge_vehicles",
  "detailSourceUrl": "https://www.spviewer.eu",
  "detailSource": {
    "name": "SPViewer",
    "url": "https://www.spviewer.eu",
    "lastSuccessfulUpdateAt": "2026-04-23T00:00:00.000Z",
    "usedFallback": false,
    "fallbackReason": null
  },
  "shipCount": 255,
  "manufacturers": [
    {
      "slug": "origin-jumpworks",
      "name": "Origin Jumpworks",
      "logos": {
        "default": {
          "path": "media/manufacturers/origin-jumpworks/black.png",
          "primaryUrl": "https://starcitizen-info.pages.dev/media/manufacturers/origin-jumpworks/black.png",
          "fallbackUrl": "https://therealwisewolfholo.github.io/StarCitizen-Info/media/manufacturers/origin-jumpworks/black.png"
        }
      }
    }
  ],
  "ships": [
    {
      "name": "100i",
      "pageUrl": "https://starcitizen.tools/100i",
      "manufacturerSlug": "origin-jumpworks",
      "size": "Small",
      "minCrew": 1,
      "maxCrew": 1,
      "technicalSpecs": [
        { "label": "Length", "value": "19 m" }
      ],
      "specificationSections": [
        {
          "tab": "Weapons & Utility",
          "title": "Weapons",
          "items": [
            {
              "name": "CF-337 Panther Repeater",
              "count": 2,
              "size": "S3",
              "subtitle": "1,500 HP · A"
            }
          ],
          "summaryBySize": [
            { "size": "S3", "count": 2, "entryCount": 1 }
          ]
        }
      ],
      "weaponsUtilitySummary": {
        "bySection": [
          {
            "section": "Weapons",
            "size": "S3",
            "count": 2,
            "entryCount": 1
          }
        ]
      }
    }
  ]
}
```

Notes for `ship-details.json`:

- `technicalSpecs`, `size`, `minCrew`, and `maxCrew` come from the pledge vehicle list.
- `description`, `technicalSections`, and `specificationSections` are sourced from SPViewer where a SPViewer performance page is available.
- `detailSource.lastSuccessfulUpdateAt` records the most recent successful SPViewer detail scrape. If SPViewer is temporarily unavailable, the generator reuses the previous detail snapshot and leaves this timestamp unchanged.
- `specificationSections` mirrors the SPViewer loadout sections and preserves per-card `count`, `size`, `name`, and `subtitle`.
- `componentSummary` and `weaponsUtilitySummary` provide pre-aggregated size counts so clients can answer questions like "how many S3 weapons are mounted?" without reparsing the raw cards.
- Concept or production-hold ships that do not have a SPViewer performance page still keep the list-source metadata and publish empty detail/loadout sections with an `unavailableReason`.
- Both feeds now publish a top-level `manufacturers` directory. Each entry includes a stable `slug`, any known aliases, and `logos` with:
  - relative `path`
  - `primaryUrl` for `https://starcitizen-info.pages.dev`
  - `fallbackUrl` for GitHub Pages
  - optional `onLightBackground`, `onDarkBackground`, and per-variant addresses when multiple logo treatments are available
- Ship entries include `manufacturerSlug` so clients can join a ship to the top-level manufacturer logo directory without reparsing the display name.

## Local Usage

Run the generator locally:

```bash
npm run build
```

Optional local test controls:

```bash
SHIP_DETAILS_LIMIT=5 SPVIEWER_DETAIL_CONCURRENCY=2 node scripts/build-ship-details-json.mjs
```

That writes the latest output to:

- `docs/ships.json`
- `docs/ship-details.json`
- `docs/resource-manifest.json`
- `docs/media/ships/*`
- `docs/media/manufacturers/*`

## GitHub Pages

This repo includes `.github/workflows/publish-ships.yml`, which:

- builds the JSON feed on every push to `main`
- lets you run it manually with `workflow_dispatch`
- refreshes the feed once per day at `12:00 UTC`

As of April 18, 2026 in `America/New_York`, that is:

- `8:00 AM EDT`
- `7:00 AM EST` after the fall time change

After the first push:

1. Open the repo on GitHub.
2. Go to `Settings -> Pages`.
3. Make sure the source is `GitHub Actions`.
4. Run the `Publish ship feed` workflow once if GitHub does not do it automatically.

Your public URLs should then be:

- `https://therealwisewolfholo.github.io/StarCitizen-Info/`
- `https://therealwisewolfholo.github.io/StarCitizen-Info/ships.json`

## App Consumption

Swift example:

```swift
struct ShipFeed: Decodable {
    let generatedAt: String
    let count: Int
    let ships: [Ship]
}

struct Ship: Decodable, Identifiable {
    let id: String
    let name: String?
    let manufacturer: String?
    let msrpUsd: Double?
    let purchasable: Bool
}

let url = URL(string: "https://therealwisewolfholo.github.io/StarCitizen-Info/ships.json")!
let (data, _) = try await URLSession.shared.data(from: url)
let feed = try JSONDecoder().decode(ShipFeed.self, from: data)
```

## Notes

- RSI exposes MSRP in cents, so this feed publishes both `msrpCentsUsd` and `msrpUsd`.
- The detailed ship spec feed is separate from the lightweight MSRP feed so apps can choose between smaller list payloads and richer per-ship specification data.
- When RSI marks a ship as unavailable and does not publish a live MSRP, the feed publishes `msrpLabel: "Not For Sale"` so apps can distinguish that from truly incomplete pricing data.
- Ship thumbnails are mirrored into GitHub Pages on every build. The feed preserves the original RSI URL in `sourceThumbnailUrl` and `sourceThumbnailUrls` so clients can rewrite matching live RSI assets to the mirrored copy without changing fallback behavior.
- Manufacturer logos are published as static PNG assets under `docs/media/manufacturers/*`. When a manufacturer logo is available from the supplied fan kit, the feeds expose both relative paths and absolute URLs for the primary and fallback hosts.
- The workflow does not commit generated JSON back into the repo on each daily run.
  - GitHub Pages serves the freshly generated artifact from the workflow instead.
- If you ever want Cloudflare Pages instead, you can keep the same `docs` output and point Cloudflare at this repo.
