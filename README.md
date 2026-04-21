# StarCitizen-Info

Public Star Citizen ship MSRP feed generated from the live RSI pledge ship listing.

## What It Publishes

- `ships.json`
  - JSON feed your mobile app can fetch directly
- `index.html`
  - Human-friendly browser view of the same data

The feed is built from:

- source page:
  - `https://robertsspaceindustries.com/en/pledge/ships?sale=true&sale=false&sortField=name&sortDirection=asc`
- source GraphQL endpoint:
  - `https://robertsspaceindustries.com/graphql`

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
  "ships": [
    {
      "id": "159",
      "name": "100i",
      "manufacturer": "Origin Jumpworks",
      "msrpCentsUsd": 5000,
      "msrpUsd": 50,
      "purchasable": true,
      "productionStatus": "flight-ready",
      "thumbnailUrl": "https://robertsspaceindustries.com/i/..."
    }
  ]
}
```

## Local Usage

Run the generator locally:

```bash
npm run build
```

That writes the latest output to:

- `docs/ships.json`

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
- When RSI marks a ship as unavailable and does not publish a live MSRP, the feed publishes `msrpLabel: "Not For Sale"` so apps can distinguish that from truly incomplete pricing data.
- The workflow does not commit generated JSON back into the repo on each daily run.
  - GitHub Pages serves the freshly generated artifact from the workflow instead.
- If you ever want Cloudflare Pages instead, you can keep the same `docs` output and point Cloudflare at this repo.
