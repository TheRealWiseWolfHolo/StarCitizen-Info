# StarCitizen-Info

Public Star Citizen ship and event data feeds generated from official RSI sources, StarCitizen.tools, SPViewer, and Bar Citizens International.

## What It Publishes

- `ships.json`
  - JSON feed your mobile app can fetch directly, including current public Warbond CCU offers from the RSI ship upgrade app
- `ship-details.json`
  - detailed ship metadata that keeps size, crew, status, and pledge availability from the StarCitizen.tools pledge vehicle list while sourcing component and weapon loadouts from SPViewer
- `limited-ships.json`
  - alpha feed of timed limited-ship purchase targets for Hangar Express cart automation
- `events.json`
  - validated official Star Citizen and community Bar Citizen dates for the Hangar Express Event Calendar
- `item-translations/zh-Hans.json`
  - manually curated Simplified Chinese item-name dictionary for strict on-device Hangar display translation
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
- source ship upgrade GraphQL endpoint:
  - `https://robertsspaceindustries.com/pledge-store/api/upgrade/v2/graphql`
- source ship detail pages:
  - `https://starcitizen.tools/List_of_pledge_vehicles`
- source component and weapon detail pages:
  - `https://www.spviewer.eu/`
- curated item translation source:
  - `data/item-translations/zh-Hans.json`
- official event source:
  - `https://robertsspaceindustries.com/en/comm-link`
- Bar Citizen event source:
  - `https://www.barcitizen.org/eventlist`
- curated official event records:
  - `data/events/official-events.json`
- annual anticipated-event templates:
  - `data/events/anticipated-events.json`

## Credits And Data Attribution

- [SPViewer](https://www.spviewer.eu/) provides the ship performance/detail data used by `docs/ship-details.json`.
- SPViewer-backed fields include `description`, `technicalSections`, `specificationSections`, `componentEntries`, `weaponsUtilityEntries`, `componentSummary`, `weaponsUtilitySummary`, `spviewerId`, `spviewerName`, and `spviewerPageUrl`.
- StarCitizen.tools provides the pledge vehicle list metadata preserved in `docs/ship-details.json`, including ship names, source page URLs, manufacturer names, size, crew, in-game status, and pledge availability.
- RSI provides the pledge ship listing, MSRP data, current store availability, public Warbond ship upgrade offers, production status, and source ship media mirrored by `docs/ships.json`.
- Item translations are manually curated in this repository and are not machine translated during the build.
- Official event dates are manually verified against CIG Comm-Link announcements. Bar Citizen dates are imported from Bar Citizens International, validated, and quarantined when a range is suspicious.
- Anticipated annual dates are generated from the official 2025 month/day windows. They use `dateConfidence: "anticipated"`, retain the prior-year official reference, and roll to the next occurrence after the feed generation date; they must not be presented as confirmed CIG dates.

`docs/events.json` publishes the calendar contract:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-26T12:00:00.000Z",
  "count": 2,
  "sources": [
    {
      "id": "barCitizen",
      "status": "fresh",
      "usedPreviousData": false,
      "quarantinedCount": 1
    }
  ],
  "events": [
    {
      "id": "barcitizen:pax-west-2026-bar-citizen",
      "title": "PAX West 2026 Bar Citizen",
      "category": "barCitizen",
      "eventType": "inPerson",
      "organizer": "Bar Citizens International",
      "verification": "communityPublished",
      "dateConfidence": "confirmed",
      "status": "scheduled",
      "schedule": {
        "kind": "timed",
        "startsAt": "2026-09-05T01:00:00.000Z",
        "endsAt": "2026-09-05T04:00:00.000Z",
        "originalTimeZone": "PDT"
      },
      "location": {
        "isOnline": false,
        "city": "Seattle",
        "countryCode": "US",
        "formattedAddress": "1158 Broadway, Seattle, WA 98122, USA"
      },
      "links": [
        {
          "role": "source",
          "label": "Event details and RSVP",
          "url": "https://www.barcitizen.org/event-details/pax-west-2026-bar-citizen"
        }
      ]
    }
  ],
  "quarantine": [
    {
      "sourceURL": "https://www.barcitizen.org/event-details/example",
      "reasons": ["Bar Citizen event duration exceeds seven days"]
    }
  ]
}
```

## JSON Shape

`docs/ships.json` looks like this:

```json
{
  "generatedAt": "2026-04-18T21:00:00.000Z",
  "count": 250,
  "storeUpgradeOfferCount": 4,
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
  "storeUpgradeOffers": [
    {
      "id": "rsi-upgrade-sku-9001",
      "type": "warbond",
      "skuId": 9001,
      "title": "Warbond Edition",
      "targetShipId": "56",
      "targetShipName": "Cutlass Black",
      "targetShipMsrpCentsUsd": 11000,
      "targetShipMsrpUsd": 110,
      "priceCentsUsd": 9500,
      "priceUsd": 95,
      "savingsCentsUsd": 1500,
      "savingsUsd": 15,
      "available": true,
      "unlimitedStock": true,
      "availableStock": 0
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
      "storeAvailable": true,
      "storeAvailability": "Available",
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
  "storeAvailabilitySource": {
    "name": "Roberts Space Industries pledge ship listing",
    "url": "https://robertsspaceindustries.com/en/pledge/ships?sale=true&sale=false&sortField=name&sortDirection=asc",
    "field": "purchasable"
  },
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

`docs/limited-ships.json` publishes alpha limited-ship purchase targets:

```json
{
  "ships": [
    {
      "id": "gladius-standalone",
      "name": "Gladius",
      "manufacturer": "Aegis Dynamics",
      "priceUsd": 90,
      "availabilitySlots": [
        {
          "startsAt": "2026-05-01T00:00:00Z",
          "endsAt": "2026-12-31T23:59:59Z"
        }
      ],
      "storeUrl": "https://robertsspaceindustries.com/pledge/ships/gladius/Gladius",
      "imageUrl": "https://therealwisewolfholo.github.io/StarCitizen-Info/media/ships/99a752429ba21a9f1652b65de7d23ed4c4c47ea737b4bc624fb7a727e81be439.webp"
    }
  ]
}
```

`docs/item-translations/zh-Hans.json` publishes strict display translations for Hangar item names:

```json
{
  "generatedAt": "2026-06-10T00:00:00.000Z",
  "locale": "zh-Hans",
  "version": 1,
  "count": 2,
  "sourceCount": 267,
  "entries": [
    {
      "source": "F8C Lightning",
      "translation": "F8C 闪电",
      "kind": "ship",
      "aliases": ["Anvil F8C Lightning"]
    },
    {
      "source": "Package - Praetorian Pack",
      "translation": "组合包 - 禁卫包",
      "kind": "package",
      "aliases": []
    },
    {
      "source": "Standalone Ships",
      "translation": "独立舰船",
      "kind": "keyword",
      "aliases": ["Standalone Ship"]
    }
  ]
}
```

Notes for `item-translations/zh-Hans.json`:

- `source` is the exact English display text clients should match after trimming, case-folding, and whitespace normalization.
- `aliases` are alternate exact English keys that resolve to the same `translation`.
- `kind` is an advisory grouping label such as `ship`, `vehicle`, `package`, `keyword`, `upgrade`, `flair`, or `perk`.
- The source file may include blank `translation` values as draft placeholders.
- The build publishes only entries with non-empty translations and records the full draft size in `sourceCount`.
- The build rejects empty `source`/`kind` values, invalid locales, non-positive versions, empty entry lists, and duplicate `source` or alias keys.
- Clients should leave unmatched item text unchanged.

Notes for `ship-details.json`:

- `technicalSpecs`, `size`, `minCrew`, and `maxCrew` come from the pledge vehicle list.
- `description`, `technicalSections`, and `specificationSections` are sourced from SPViewer where a SPViewer performance page is available.
- `detailSource.lastSuccessfulUpdateAt` records the most recent successful SPViewer detail scrape. If the last SPViewer scrape is less than 23 hours old, or if SPViewer is temporarily unavailable, the generator reuses the previous detail snapshot and leaves this timestamp unchanged.
- `specificationSections` mirrors the SPViewer loadout sections and preserves per-card `count`, `size`, `name`, and `subtitle`.
- `componentSummary` and `weaponsUtilitySummary` provide pre-aggregated size counts so clients can answer questions like "how many S3 weapons are mounted?" without reparsing the raw cards.
- Concept or production-hold ships that do not have a SPViewer performance page still keep the list-source metadata and publish empty detail/loadout sections with an `unavailableReason`.
- Both feeds now publish a top-level `manufacturers` directory. Each entry includes a stable `slug`, any known aliases, and `logos` with:
  - relative `path`
  - `primaryUrl` for `https://starcitizen-info.pages.dev`
  - `fallbackUrl` for GitHub Pages
  - optional `onLightBackground`, `onDarkBackground`, and per-variant addresses when multiple logo treatments are available
- Ship entries include `manufacturerSlug` so clients can join a ship to the top-level manufacturer logo directory without reparsing the display name.
- `storeUpgradeOffers` contains target-level Warbond upgrade offers from the RSI ship upgrade app. The generator first finds Warbond candidates in the upgrade initializer, then verifies each candidate still appears in the live `ship(id, from).skus` detail response before publishing it. Clients can combine each offer with any lower-MSRP source ship where `source.msrpUsd < priceUsd`; the CCU purchase price is `priceUsd - source.msrpUsd`, the direct value is `targetShipMsrpUsd - source.msrpUsd`, and the savings are `savingsUsd`.

## Local Usage

Run the generator locally:

```bash
npm run build
```

Optional local test controls:

```bash
SHIP_DETAILS_LIMIT=5 SPVIEWER_DETAIL_CONCURRENCY=2 node scripts/build-ship-details-json.mjs
```

Before calling StarCitizen.tools or SPViewer, the ship detail generator checks
`SHIP_DETAILS_FRESHNESS_URLS`, which defaults to
`https://starcitizen-info.pages.dev/ship-details.json`. If the published payload is
less than `SHIP_DETAILS_REFRESH_MAX_AGE_HOURS` old, defaulting to 12 hours, the
generator writes that published payload to `docs/ship-details.json` and skips the
network refresh. Use `--force` or `FORCE_SHIP_DETAILS_REFRESH=1` to bypass this guard.
`PREVIOUS_SHIP_DETAILS_URLS` is still used as fallback SPViewer detail data when a
real refresh runs.

That writes the latest output to:

- `docs/ships.json`
- `docs/ship-details.json`
- `docs/item-translations/zh-Hans.json`
- `docs/resource-manifest.json`
- `docs/media/ships/*`
- `docs/media/manufacturers/*`

## GitHub Pages

This repo includes two GitHub Pages publish workflows.

`Publish ship feed` (`.github/workflows/publish-ships.yml`) is the full refresh workflow. It:

- builds the JSON feed on non-translation pushes to `main`
- lets you run it manually with `workflow_dispatch`
- refreshes the feed every 12 hours at `00:00 UTC` and `12:00 UTC`
- reuses the last successful SPViewer detail snapshot when it is less than 12 hours old, while still refreshing the RSI ship list and store availability on every run

`Publish item translations` (`.github/workflows/publish-item-translations.yml`) is the translation-only workflow. It:

- runs on pushes that touch item translation source, generated item translation JSON, translation build scripts, or related workflow files
- hydrates `docs/` from the currently published Pages feeds before generating the translation feed
- runs only `node scripts/build-item-translations-json.mjs`
- deploys the updated `docs/item-translations/zh-Hans.json` without calling RSI, StarCitizen.tools, SPViewer, Playwright, or the full `npm run build`

This keeps manual translation edits fast and avoids triggering a full ship refresh just to publish
`zh-Hans.json`. Mixed commits that include non-translation feed changes are intentionally left to the
full workflow.

The translation-only path does not break the scheduled refresh. GitHub Actions `paths` and
`paths-ignore` filters apply to `push` events only; the existing `schedule` entries still run the full
refresh every day at `00:00 UTC` and `12:00 UTC`, and `workflow_dispatch` still runs the full refresh
when selected manually.
Translation-only deploys share the same Pages concurrency group and queue behind an active full refresh.

As of May 16, 2026 in `America/New_York`, those scheduled runs are:

- `8:00 PM EDT` and `8:00 AM EDT`
- `7:00 PM EST` and `7:00 AM EST` after the fall time change

After the first push:

1. Open the repo on GitHub.
2. Go to `Settings -> Pages`.
3. Make sure the source is `GitHub Actions`.
4. Run the `Publish ship feed` workflow once if GitHub does not do it automatically.

Your public URLs should then be:

- `https://therealwisewolfholo.github.io/StarCitizen-Info/`
- `https://therealwisewolfholo.github.io/StarCitizen-Info/ships.json`
- `https://therealwisewolfholo.github.io/StarCitizen-Info/item-translations/zh-Hans.json`

### Publishing Item Translations Only

To update Simplified Chinese item translations without a full refresh:

1. Edit `data/item-translations/zh-Hans.json`.
2. Run `node scripts/build-item-translations-json.mjs` locally if you want to validate before pushing.
3. Commit and push the source file and generated `docs/item-translations/zh-Hans.json`.
4. Let the `Publish item translations` workflow deploy the existing published feed plus the updated translation JSON.

The workflow first downloads the current published top-level JSON files and any referenced media assets
into `docs/`. That safeguard matters because the daily full refresh serves generated artifacts directly
from GitHub Pages and does not commit those generated files back into the repository. Hydrating first
prevents a translation-only deploy from replacing a newer published ship feed with older repository
copies.

For Cloudflare Pages mirrors, keep the same `docs` output directory and use the same no-refresh
translation publish strategy. This repository does not contain a checked-in Cloudflare Pages project
configuration, so dashboard build settings still control what `starcitizen-info.pages.dev` does on a
Git push. If the Cloudflare Pages project is configured to run `npm run build` on every push, it will
still perform the full refresh; configure that project to use the committed `docs` output for
translation-only deploys, or deploy `docs` directly with Wrangler, when you only want to publish
`zh-Hans.json`.

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
- RSI store availability comes directly from RSI's pledge ship listing. `purchasable` is the raw RSI flag, while `storeAvailable` and `storeAvailability` are app-friendly derived fields.
- Some alternate RSI/wiki naming variants are retained as records for matching, but marked with `displayDuplicateOf` and `hiddenInCatalog` so catalog UIs can hide duplicate display rows without losing alias coverage.
- The detailed ship spec feed is separate from the lightweight MSRP feed so apps can choose between smaller list payloads and richer per-ship specification data.
- When RSI marks a ship as unavailable and does not publish a live MSRP, the feed publishes `msrpLabel: "Not For Sale"` so apps can distinguish that from truly incomplete pricing data.
- Ship thumbnails are mirrored into GitHub Pages on every build. The feed preserves the original RSI URL in `sourceThumbnailUrl` and `sourceThumbnailUrls` so clients can rewrite matching live RSI assets to the mirrored copy without changing fallback behavior.
- Manufacturer logos are published as static PNG assets under `docs/media/manufacturers/*`. When a manufacturer logo is available from the supplied fan kit, the feeds expose both relative paths and absolute URLs for the primary and fallback hosts.
- The workflow does not commit generated JSON back into the repo on each daily run.
  - GitHub Pages serves the freshly generated artifact from the workflow instead.
- Hangar item translations are manually curated source data copied into `docs/item-translations/*` by the build, so apps can fetch the dictionary without bundling it. Blank draft rows remain in `data/item-translations/*` until a translation is filled in.
- If you ever want Cloudflare Pages instead, you can keep the same `docs` output and point Cloudflare at this repo.
