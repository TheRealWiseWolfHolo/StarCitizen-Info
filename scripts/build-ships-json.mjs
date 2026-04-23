import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://robertsspaceindustries.com";
const GRAPHQL_URL = `${ORIGIN}/graphql`;
const SOURCE_PAGE_URL =
  `${ORIGIN}/en/pledge/ships?sale=true&sale=false&sortField=name&sortDirection=asc`;
const PAGES_BASE_URL = "https://therealwisewolfholo.github.io/StarCitizen-Info";
const PAGE_SIZE = 100;
const NOT_FOR_SALE_MSRP_LABEL = "Not For Sale";
const MEDIA_DIRECTORY_NAME = "media/ships";
const IMAGE_COMPOSERS = [
  { name: "900", size: "SIZE_900", ratio: "RATIO_16_9", extension: "WEBP" },
  { name: "1000", size: "SIZE_1000", ratio: "RATIO_16_9", extension: "WEBP" }
];
const SHIP_NAME_OVERRIDES = new Map([
  ["A2 Hercules", "Hercules Starlifter A2"],
  ["C2 Hercules", "Hercules Starlifter C2"],
  ["M2 Hercules", "Hercules Starlifter M2"],
  ["Mercury", "Mercury Star Runner"],
  ["Ursa", "Ursa Rover"],
  ["315p", "315p Explorer"],
  ["Caterpillar Best In Show Edition 2949", "Caterpillar 2949 Best in Show"],
  ["Cutlass Black Best In Show Edition 2949", "Cutlass Black 2949 Best in Show"],
  ["Hammerhead Best In Show Edition 2949", "Hammerhead 2949 Best in Show"],
  ["Reclaimer Best In Show Edition 2949", "Reclaimer 2949 Best in Show"]
]);
const SYNTHETIC_SHIP_VARIANTS = [
  {
    name: "Gladius Dunlevy",
    sourceName: "Gladius",
    thumbnailUrl: "https://media.robertsspaceindustries.com/nuv5c3lkfqrbd/source.jpg"
  },
  {
    name: "Mustang Omega : AMD Edition",
    sourceName: "Mustang Omega",
    overrides: {
      msrpCentsUsd: null,
      msrpUsd: null,
      msrpLabel: NOT_FOR_SALE_MSRP_LABEL,
      purchasable: false
    }
  },
  {
    name: "Genesis Starliner",
    sourceName: "Genesis"
  },
  {
    name: "Cutlass 2949 Best In Show",
    sourceName: "Cutlass Black 2949 Best in Show"
  },
  {
    name: "Reliant Tana - Skirmisher",
    sourceName: "Reliant Tana"
  },
  {
    name: "350r Racer",
    sourceName: "350r"
  },
  {
    name: "600i Touring Module",
    sourceName: "600i Touring"
  },
  {
    name: "600i Exploration Module",
    sourceName: "600i Explorer"
  },
  {
    name: "600i Executive Edition",
    sourceName: "600i Touring",
    overrides: {
      msrpCentsUsd: null,
      msrpUsd: null,
      msrpLabel: NOT_FOR_SALE_MSRP_LABEL,
      purchasable: false
    }
  },
  {
    name: "Ursa Rover Fortuna",
    sourceName: "Ursa Fortuna"
  },
  {
    name: "Nova Tank",
    sourceName: "Nova"
  },
  {
    name: "Dragonfly Star Kitten Edition",
    sourceName: "Dragonfly Black",
    overrides: {
      msrpCentsUsd: null,
      msrpUsd: null,
      msrpLabel: NOT_FOR_SALE_MSRP_LABEL,
      purchasable: false
    }
  }
];

const SHIP_LIST_QUERY = `query GetShipList($query: SearchQuery!, $storeFront: String = "pledge") {
  store(name: $storeFront, browse: true) {
    search(query: $query) {
      count
      totalCount
      resources {
        ...RSIShipListFragment
        __typename
      }
      __typename
    }
    __typename
  }
}

fragment RSIShipListFragment on RSIShip {
  ...RSIShipBaseFragment
  manufacturerId
  featuredForShipList
  minCrew
  maxCrew
  manufacturer {
    ...RSIManufacturerMinimalFragment
    __typename
  }
  imageComposer {
    ...ImageComposerFragment
    __typename
  }
  __typename
}

fragment RSIManufacturerMinimalFragment on RSIManufacturer {
  name
  __typename
}

fragment ImageComposerFragment on ImageComposer {
  name
  slot
  url
  __typename
}

fragment RSIShipBaseFragment on RSIShip {
  id
  title
  name
  url
  slug
  type
  focus
  msrp
  purchasable
  productionStatus
  lastUpdate
  publishStart
  __typename
}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const OUTPUT_PATH = resolve(PROJECT_ROOT, "docs", "ships.json");
const RESOURCE_MANIFEST_OUTPUT_PATH = resolve(PROJECT_ROOT, "docs", "resource-manifest.json");
const MEDIA_OUTPUT_PATH = resolve(PROJECT_ROOT, "docs", "media", "ships");

function buildQueryVariables(page) {
  return {
    storeFront: "pledge",
    query: {
      page,
      limit: PAGE_SIZE,
      sort: {
        field: "name",
        direction: "asc"
      },
      ships: {
        filters: {
          sale: [true, false]
        },
        imageComposer: IMAGE_COMPOSERS,
        all: false
      }
    }
  };
}

function absoluteUrl(value) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, ORIGIN).toString();
  } catch {
    return null;
  }
}

function createThumbnailUrls(imageComposer) {
  const thumbnails = {};

  for (const item of imageComposer ?? []) {
    if (!item?.name || !item?.url) {
      continue;
    }

    thumbnails[item.name] = absoluteUrl(item.url);
  }

  return thumbnails;
}

function pickPrimaryThumbnail(thumbnailUrls) {
  return (
    thumbnailUrls["1000"] ??
    thumbnailUrls["900"] ??
    Object.values(thumbnailUrls)[0] ??
    null
  );
}

function normalizeShipName(name) {
  if (!name) {
    return null;
  }

  return SHIP_NAME_OVERRIDES.get(name) ?? name;
}

function deriveMsrpLabel({ msrpCentsUsd, purchasable }) {
  if (msrpCentsUsd === null && purchasable === false) {
    return NOT_FOR_SALE_MSRP_LABEL;
  }

  return null;
}

function normalizeShip(resource) {
  const normalizedName = normalizeShipName(resource.name ?? resource.title ?? null);
  const thumbnailUrls = createThumbnailUrls(resource.imageComposer);
  const msrpCentsUsd =
    typeof resource.msrp === "number" && Number.isFinite(resource.msrp)
      ? resource.msrp
      : null;
  const purchasable = Boolean(resource.purchasable);
  const msrpLabel = deriveMsrpLabel({ msrpCentsUsd, purchasable });

  return {
    id: String(resource.id ?? ""),
    title: normalizedName,
    name: normalizedName,
    slug: resource.slug ?? null,
    url: absoluteUrl(resource.url),
    manufacturerId:
      typeof resource.manufacturerId === "number" ? resource.manufacturerId : null,
    manufacturer: resource.manufacturer?.name ?? null,
    type: resource.type ?? null,
    focus: resource.focus ?? null,
    msrpCentsUsd,
    msrpUsd: msrpCentsUsd === null ? null : msrpCentsUsd / 100,
    ...(msrpLabel ? { msrpLabel } : {}),
    purchasable,
    productionStatus: resource.productionStatus ?? null,
    featuredForShipList: Boolean(resource.featuredForShipList),
    minCrew: typeof resource.minCrew === "number" ? resource.minCrew : null,
    maxCrew: typeof resource.maxCrew === "number" ? resource.maxCrew : null,
    publishStart: resource.publishStart ?? null,
    lastUpdate: resource.lastUpdate ?? null,
    thumbnailUrl: pickPrimaryThumbnail(thumbnailUrls),
    thumbnailUrls
  };
}

function mediaRequestHeaders(referer = SOURCE_PAGE_URL) {
  return {
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": referer,
    "User-Agent": "Mozilla/5.0"
  };
}

function hashSourceURL(sourceURL) {
  return createHash("sha256").update(sourceURL).digest("hex");
}

function extensionForContentType(contentType) {
  const normalizedType = contentType?.split(";")[0]?.trim().toLowerCase();
  switch (normalizedType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/avif":
      return ".avif";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

function inferMirroredExtension(sourceURL, contentType) {
  try {
    const sourceExtension = extname(new URL(sourceURL).pathname).toLowerCase();
    if (sourceExtension) {
      return sourceExtension;
    }
  } catch {
    // Fall back to content type below.
  }

  return extensionForContentType(contentType) || ".bin";
}

function mirroredMediaURL(fileName) {
  return `${PAGES_BASE_URL}/${MEDIA_DIRECTORY_NAME}/${fileName}`;
}

async function mirrorMediaAsset(sourceURL) {
  const response = await fetch(sourceURL, {
    headers: mediaRequestHeaders(sourceURL)
  });

  if (!response.ok) {
    throw new Error(`Media mirror request failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  const extension = inferMirroredExtension(sourceURL, contentType);
  const fileName = `${hashSourceURL(sourceURL)}${extension}`;
  const outputPath = resolve(MEDIA_OUTPUT_PATH, fileName);
  const body = Buffer.from(await response.arrayBuffer());

  await writeFile(outputPath, body);

  return {
    sourceUrl: sourceURL,
    mirroredUrl: mirroredMediaURL(fileName),
    fileName,
    contentType: contentType ?? null
  };
}

function rewriteThumbnailMap(thumbnailUrls, mirroredResourcesBySource) {
  return Object.fromEntries(
    Object.entries(thumbnailUrls).map(([key, value]) => [
      key,
      mirroredResourcesBySource.get(value)?.mirroredUrl ?? value
    ])
  );
}

async function mirrorShipMedia(ships) {
  await rm(MEDIA_OUTPUT_PATH, { recursive: true, force: true });
  await mkdir(MEDIA_OUTPUT_PATH, { recursive: true });

  const sourceURLs = Array.from(
    new Set(
      ships.flatMap((ship) => [
        ship.thumbnailUrl,
        ...Object.values(ship.thumbnailUrls ?? {})
      ]).filter(Boolean)
    )
  );

  const mirroredResourcesBySource = new Map();

  for (const sourceURL of sourceURLs) {
    try {
      const mirroredResource = await mirrorMediaAsset(sourceURL);
      mirroredResourcesBySource.set(sourceURL, mirroredResource);
    } catch (error) {
      console.warn(`Unable to mirror ${sourceURL}: ${error.message}`);
    }
  }

  const mirroredShips = ships.map((ship) => {
    const sourceThumbnailUrl = ship.thumbnailUrl;
    const sourceThumbnailUrls = { ...ship.thumbnailUrls };
    const mirroredThumbnailUrls = rewriteThumbnailMap(sourceThumbnailUrls, mirroredResourcesBySource);

    return {
      ...ship,
      sourceThumbnailUrl,
      sourceThumbnailUrls,
      thumbnailUrl: sourceThumbnailUrl
        ? mirroredResourcesBySource.get(sourceThumbnailUrl)?.mirroredUrl ?? sourceThumbnailUrl
        : null,
      thumbnailUrls: mirroredThumbnailUrls
    };
  });

  return {
    ships: mirroredShips,
    resources: Array.from(mirroredResourcesBySource.values()).sort((left, right) =>
      left.fileName.localeCompare(right.fileName)
    )
  };
}

function appendSyntheticShipVariants(ships) {
  const existingNames = new Set(ships.map((ship) => ship.name));
  let nextSyntheticID = ships.reduce((currentMax, ship) => {
    const numericID = Number.parseInt(ship.id, 10);
    return Number.isFinite(numericID) ? Math.max(currentMax, numericID) : currentMax;
  }, 0);

  for (const variant of SYNTHETIC_SHIP_VARIANTS) {
    if (existingNames.has(variant.name)) {
      continue;
    }

    const sourceShip = ships.find((ship) => ship.name === variant.sourceName);
    if (!sourceShip) {
      continue;
    }

    nextSyntheticID += 1;
    ships.push({
      ...sourceShip,
      id: String(nextSyntheticID),
      title: variant.name,
      name: variant.name,
      ...(variant.overrides ?? {}),
      thumbnailUrl: variant.thumbnailUrl ?? sourceShip.thumbnailUrl,
      thumbnailUrls: variant.thumbnailUrl
        ? {
            ...sourceShip.thumbnailUrls,
            "900": variant.thumbnailUrl,
            "1000": variant.thumbnailUrl
          }
        : sourceShip.thumbnailUrls
    });
    existingNames.add(variant.name);
  }

  return ships;
}

function buildSummary(ships) {
  const manufacturers = new Map();
  let purchasableCount = 0;
  let unavailableCount = 0;
  let flightReadyCount = 0;
  let inConceptCount = 0;

  for (const ship of ships) {
    if (ship.purchasable) {
      purchasableCount += 1;
    } else {
      unavailableCount += 1;
    }

    if (ship.productionStatus === "flight-ready") {
      flightReadyCount += 1;
    }

    if (ship.productionStatus === "in-concept") {
      inConceptCount += 1;
    }

    const key = ship.manufacturer ?? "Unknown";
    manufacturers.set(key, (manufacturers.get(key) ?? 0) + 1);
  }

  return {
    purchasableCount,
    unavailableCount,
    flightReadyCount,
    inConceptCount,
    manufacturers: Array.from(manufacturers.entries())
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return left[0].localeCompare(right[0]);
      })
      .map(([name, count]) => ({ name, count }))
  };
}

async function fetchShipPage(page) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/json;charset=UTF-8",
      "Origin": ORIGIN,
      "Referer": SOURCE_PAGE_URL,
      "User-Agent": "Mozilla/5.0"
    },
    body: JSON.stringify([
      {
        operationName: "GetShipList",
        variables: buildQueryVariables(page),
        query: SHIP_LIST_QUERY
      }
    ])
  });

  if (!response.ok) {
    throw new Error(`RSI GraphQL request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  const result = Array.isArray(payload) ? payload[0] : payload;

  if (result?.errors?.length) {
    const message = result.errors
      .map((entry) => entry?.message ?? "Unknown GraphQL error")
      .join("; ");
    throw new Error(`RSI GraphQL returned errors: ${message}`);
  }

  const search = result?.data?.store?.search;
  if (!search) {
    throw new Error("RSI GraphQL response did not contain store.search data.");
  }

  return search;
}

async function fetchAllShips() {
  const collected = [];
  const seenIds = new Set();
  let totalCount = 0;
  let page = 1;

  while (true) {
    const search = await fetchShipPage(page);
    const resources = search.resources ?? [];

    if (!totalCount) {
      totalCount = search.totalCount ?? resources.length;
    }

    for (const resource of resources) {
      const id = String(resource.id ?? "");
      if (!id || seenIds.has(id)) {
        continue;
      }

      seenIds.add(id);
      collected.push(resource);
    }

    if (!resources.length || collected.length >= totalCount) {
      break;
    }

    page += 1;
  }

  return {
    totalCount,
    ships: collected
  };
}

async function main() {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });

  const { totalCount, ships } = await fetchAllShips();
  const normalizedShips = appendSyntheticShipVariants(
    ships.map(normalizeShip)
  )
    .sort((left, right) => (left.name ?? "").localeCompare(right.name ?? ""));
  const mirroredOutput = await mirrorShipMedia(normalizedShips);
  const syntheticCount = Math.max(0, normalizedShips.length - totalCount);

  const output = {
    generatedAt: new Date().toISOString(),
    source: {
      page: SOURCE_PAGE_URL,
      graphql: GRAPHQL_URL
    },
    query: {
      sortField: "name",
      sortDirection: "asc",
      sale: [true, false]
    },
    count: mirroredOutput.ships.length,
    totalCount,
    syntheticCount,
    summary: buildSummary(mirroredOutput.ships),
    ships: mirroredOutput.ships
  };

  const resourceManifest = {
    generatedAt: output.generatedAt,
    count: mirroredOutput.resources.length,
    resources: mirroredOutput.resources
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await writeFile(
    RESOURCE_MANIFEST_OUTPUT_PATH,
    `${JSON.stringify(resourceManifest, null, 2)}\n`,
    "utf8"
  );
  console.log(`Wrote ${mirroredOutput.ships.length} ships to ${OUTPUT_PATH}`);
  console.log(`Wrote ${mirroredOutput.resources.length} mirrored media resources to ${MEDIA_OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
