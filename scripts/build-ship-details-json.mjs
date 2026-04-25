import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
import {
  buildManufacturerDirectory,
  resolveManufacturer
} from "./manufacturer-logos.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsDir = path.resolve(__dirname, "..", "docs");
const outputPath = path.join(docsDir, "ship-details.json");

const LIST_URL = "https://starcitizen.tools/List_of_pledge_vehicles";
const SITE_ORIGIN = "https://starcitizen.tools";
const SPVIEWER_ORIGIN = "https://www.spviewer.eu";
const SPVIEWER_DETAIL_CONCURRENCY = parsePositiveInteger(
  process.env.SPVIEWER_DETAIL_CONCURRENCY,
  4
);
const SHIP_DETAILS_LIMIT = parsePositiveInteger(process.env.SHIP_DETAILS_LIMIT, 0);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

const SPVIEWER_WEAPONS_TABS = new Set([
  "Weapons",
  "Manned Turrets",
  "Remote Turrets",
  "PDC Turrets",
  "Missiles & Bombs",
  "EMP",
  "QED",
  "Mining",
  "Salvage",
  "Utility",
  "Defense",
  "Self Destruct"
]);

const SPVIEWER_LOADOUT_TABS = {
  Weapons: "Weapons & Utility",
  "Manned Turrets": "Weapons & Utility",
  "Remote Turrets": "Weapons & Utility",
  "PDC Turrets": "Weapons & Utility",
  "Missiles & Bombs": "Weapons & Utility",
  EMP: "Weapons & Utility",
  QED: "Weapons & Utility",
  Mining: "Weapons & Utility",
  Salvage: "Weapons & Utility",
  Utility: "Weapons & Utility",
  Defense: "Weapons & Utility",
  "Self Destruct": "Weapons & Utility",
  Shields: "Avionics & Systems",
  Coolers: "Avionics & Systems",
  "Power Plants": "Avionics & Systems",
  "Quantum Drives": "Propulsion & Thrusters",
  "Jump Drives": "Propulsion & Thrusters",
  "Fuel Intakes": "Propulsion & Thrusters",
  "Fuel Tanks": "Fuel",
  "Quantum Fuel Tanks": "Fuel",
  "Flight Controller": "Avionics & Systems",
  "Life Support": "Avionics & Systems",
  Radar: "Avionics & Systems",
  Cargo: "Cargo & Facilities"
};

const SPVIEWER_LOADOUT_SECTION_TITLES = new Set(Object.keys(SPVIEWER_LOADOUT_TABS));

const SPVIEWER_CONTROL_LINES = new Set([
  "RESET",
  "QUICK SELRESET",
  "QUICK SEL",
  "more_vert",
  "expand_less",
  "expand_more",
  "launch",
  "lock",
  "No hardpoint",
  "drag_indicator"
]);

const SPVIEWER_SPECIAL_ITEM_NAMES = new Set([
  "Countermeasure",
  "Self Destruct",
  "Fuel Port",
  "Utility Port",
  "Cargo Grid",
  "Storage"
]);

const SPVIEWER_TECHNICAL_SECTION_DEFINITIONS = [
  {
    title: "Hull",
    labels: ["Dimensions", "Mass", "Total health points", "Vital Part"],
    endTitles: ["Armor", "Weaponry", "Carrying Capacity", "Fuel", "Flight Performances", "Insurance"]
  },
  {
    title: "Armor",
    labels: ["Health points", "Damage Deflection Threshold", "Durability Damage Modifiers"],
    endTitles: ["Weaponry", "Carrying Capacity", "Fuel", "Flight Performances", "Insurance"]
  },
  {
    title: "Weaponry",
    labels: ["Pilot DPS", "Crew DPS", "Missiles & Bombs", "Shield(Bubble)"],
    endTitles: ["Carrying Capacity", "Fuel", "Flight Performances", "Insurance"]
  },
  {
    title: "Carrying Capacity",
    labels: ["Cargo Grid", "Storage"],
    endTitles: ["Fuel", "Flight Performances", "Insurance"]
  },
  {
    title: "Fuel",
    labels: ["Hydrogen", "Quantum", "subdirectory_arrow_rightRange", "Refuel Cost"],
    endTitles: ["Flight Performances", "Insurance"]
  },
  {
    title: "Flight Performances",
    labels: [
      "Mode toggling",
      "SCM / Forward Boost",
      "NAV",
      "Boost Ramp Up / Ramp Down",
      "Pitch / Yaw / Roll",
      "Boosted",
      "Accelerations",
      "Main",
      "Retro",
      "Up",
      "Down",
      "Strafe"
    ],
    endTitles: ["Insurance", "Continuous fire info", "POWER - COOLING - WEIGHT DISTRIBUTION"]
  },
  {
    title: "Insurance",
    labels: ["Claim / Expedite", "Expedite cost"],
    endTitles: ["Continuous fire info", "POWER - COOLING - WEIGHT DISTRIBUTION"]
  }
];

const SPVIEWER_MANUFACTURER_PREFIXES_BY_SLUG = {
  "aegis-dynamics": ["Aegis"],
  "anvil-aerospace": ["Anvil"],
  aopoa: ["Aopoa"],
  "argo-astronautics": ["Argo"],
  banu: ["Banu", "Banu Suli"],
  "consolidated-outland": ["CNOU", "Consolidated Outland", "C.O."],
  "crusader-industries": ["Crusader"],
  "drake-interplanetary": ["Drake"],
  esperia: ["Esperia"],
  "gatac-manufacture": ["Gatac"],
  "greys-market": ["Grey's Market", "Greys Market"],
  "greycat-industrial": ["Greycat"],
  "kruger-intergalactic": ["Kruger"],
  misc: ["MISC"],
  mirai: ["Mirai"],
  "origin-jumpworks": ["Origin"],
  "roberts-space-industries": ["RSI"],
  tumbril: ["Tumbril"]
};

const SPVIEWER_NAME_ALIASES = {
  "600i Executive Edition": ["600i", "Origin 600i"],
  "600i Explorer": ["600i", "Origin 600i"],
  "85X": ["85X Limited", "Origin 85X Limited"],
  "A.T.L.S.": ["ATLS", "Argo ATLS"],
  "ATLS": ["ATLS", "Argo ATLS"],
  "ATLS GEO": ["ATLS", "Argo ATLS"],
  "ATLS GEO IKTI": ["ATLS", "Argo ATLS"],
  "ATLS IKTI": ["ATLS", "Argo ATLS"],
  "Aurora Mk I CL": ["Aurora CL", "RSI Aurora CL"],
  "Aurora Mk I LN": ["Aurora LN", "RSI Aurora LN"],
  "Aurora Mk I LX": ["Aurora LX", "RSI Aurora LX"],
  "Aurora Mk I MR": ["Aurora MR", "RSI Aurora MR"],
  "Ballista Dunestalker": ["Ballista", "Anvil Ballista"],
  "Ballista Snowblind": ["Ballista", "Anvil Ballista"],
  "Blade (replica)": ["Blade", "Esperia Blade"],
  "Carrack Expedition": ["Carrack", "Anvil Carrack"],
  "Caterpillar Best In Show Edition": ["Caterpillar", "Drake Caterpillar"],
  "F8C Lightning Executive Edition": ["F8C Lightning", "Anvil F8C Lightning"],
  "Constellation Phoenix Emerald": ["Constellation Phoenix", "RSI Constellation Phoenix"],
  "Cutlass Black Best In Show Edition": ["Cutlass Black", "Drake Cutlass Black"],
  "Dragonfly Black": ["Dragonfly", "Drake Dragonfly"],
  "Dragonfly Star Kitten": ["Dragonfly", "Drake Dragonfly"],
  "F7C Hornet Wildfire Mk I": ["F7C Hornet Wildfire", "Anvil F7C Hornet Wildfire"],
  "F7C-M Super Hornet Heartseeker Mk I": [
    "F7C-M Hornet Heartseeker Mk I",
    "Anvil F7C-M Hornet Heartseeker Mk I"
  ],
  "F7C-R Hornet Tracker Mk I": ["F7C-R Hornet Tracker", "Anvil F7C-R Hornet Tracker"],
  "F7C-S Hornet Ghost Mk I": ["F7C-S Hornet Ghost", "Anvil F7C-S Hornet Ghost"],
  "Glaive (replica)": ["Glaive", "Esperia Glaive"],
  "Hammerhead Best In Show Edition": ["Hammerhead", "Aegis Hammerhead"],
  HoverQuad: ["C.O. HoverQuad", "CNOU HoverQuad"],
  "MOLE - Carbon Edition": ["MOLE", "Argo MOLE"],
  "MOLE Carbon": ["MOLE", "Argo MOLE"],
  "MOLE Talus": ["MOLE", "Argo MOLE"],
  "M50": ["M50 Interceptor", "Origin M50 Interceptor"],
  Merchantman: ["Banu Merchantman", "Banu Suli Merchantman"],
  "Mustang Alpha Vindicator": ["Mustang Alpha", "C.O. Mustang Alpha", "CNOU Mustang Alpha"],
  "Nautilus Solstice Edition": ["Nautilus", "Aegis Nautilus"],
  "Nox Kue": ["Nox", "Aopoa Nox"],
  "P-72 Archimedes Emerald": ["P-72 Archimedes", "Kruger P-72 Archimedes"],
  "Reclaimer Best In Show Edition": ["Reclaimer", "Aegis Reclaimer"],
  "Sabre Raven": ["Sabre", "Aegis Sabre"],
  "Scythe (replica)": ["Scythe", "Vanduul Scythe"],
  "Stinger (replica)": ["Stinger", "Esperia Stinger"],
  "Ursa Fortuna": ["Ursa", "RSI Ursa"],
  "Valkyrie Liberator": ["Valkyrie", "Anvil Valkyrie"],
  "Dragonfly Star Kitten Edition": ["Dragonfly", "Drake Dragonfly"],
  "Caterpillar 2949 Best in Show": ["Caterpillar", "Drake Caterpillar"],
  "Cutlass Black 2949 Best in Show": ["Cutlass Black", "Drake Cutlass Black"],
  "Hammerhead 2949 Best in Show": ["Hammerhead", "Aegis Hammerhead"],
  "Reclaimer 2949 Best in Show": ["Reclaimer", "Aegis Reclaimer"],
  "Valkyrie Liberator Edition": ["Valkyrie", "Anvil Valkyrie"]
};

const SYNTHETIC_SHIP_DETAIL_ALIASES = [
  { name: "A.T.L.S.", sourceName: "ATLS" },
  { name: "Caterpillar 2949 Best in Show", sourceName: "Caterpillar Best In Show Edition" },
  { name: "Cutlass Black 2949 Best in Show", sourceName: "Cutlass Black Best In Show Edition" },
  { name: "Dragonfly Star Kitten Edition", sourceName: "Dragonfly Star Kitten" },
  { name: "F8C Lightning Executive Edition", sourceName: "F8C Lightning" },
  { name: "Gladius Pirate Edition", sourceName: "Gladius Pirate" },
  { name: "Hammerhead 2949 Best in Show", sourceName: "Hammerhead Best In Show Edition" },
  { name: "MOLE - Carbon Edition", sourceName: "MOLE" },
  { name: "Mustang Omega : AMD Edition", sourceName: "Mustang Omega" },
  { name: "Nautilus Solstice Edition", sourceName: "Nautilus" },
  { name: "Reclaimer 2949 Best in Show", sourceName: "Reclaimer Best In Show Edition" },
  { name: "Sabre Raven", sourceName: "Sabre" },
  { name: "Valkyrie Liberator Edition", sourceName: "Valkyrie Liberator" }
];

async function main() {
  console.log(`Fetching vehicle list from ${LIST_URL}`);
  const listHTML = await fetchText(LIST_URL);
  const ships = await buildShipDetails(listHTML);

  const payload = {
    generatedAt: new Date().toISOString(),
    sourcePageUrl: LIST_URL,
    detailSourceUrl: SPVIEWER_ORIGIN,
    shipCount: ships.length,
    manufacturers: buildManufacturerDirectory(ships.map((ship) => ship.manufacturer)),
    ships
  };

  await mkdir(docsDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${ships.length} ship detail entries to ${outputPath}`);
}

async function buildShipDetails(listHTML) {
  const $ = cheerio.load(listHTML);
  const table = $("table.srf-datatable").first();

  if (!table.length) {
    throw new Error("Could not find the pledge vehicle table on starcitizen.tools.");
  }

  const headers = table
    .find("tr")
    .first()
    .find("th")
    .map((_, header) => normalizeWhitespace($(header).text()))
    .get();

  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));

  const rows = table.find("tbody tr").toArray();
  const baseEntries = rows
    .map((row) => parseListRow($, row, headerIndex))
    .filter(Boolean);

  console.log(`Parsed ${baseEntries.length} rows from the list page`);

  const entriesToBuild = SHIP_DETAILS_LIMIT > 0
    ? baseEntries.slice(0, SHIP_DETAILS_LIMIT)
    : baseEntries;

  if (entriesToBuild.length !== baseEntries.length) {
    console.log(`SHIP_DETAILS_LIMIT=${SHIP_DETAILS_LIMIT}; building ${entriesToBuild.length} entries`);
  }

  const ships = await buildSpviewerShipDetails(entriesToBuild);

  return appendSyntheticShipDetailAliases(ships);
}

function parseListRow($, row, headerIndex) {
  const cells = $(row).find("td").toArray();
  if (!cells.length) {
    return null;
  }

  const cellText = (header) => normalizeWhitespace($(cells[headerIndex[header]]).text());
  const cellHTML = (header) => $(cells[headerIndex[header]]);

  const nameCell = cellHTML("Name");
  const nameLink = nameCell.find("a").first();
  const rawName = normalizeWhitespace(nameLink.text());
  const pagePath = nameLink.attr("href")?.trim();

  if (!rawName || !pagePath) {
    return null;
  }

  const technicalSpecs = compactSpecs([
    spec("Length", cellText("Entity length")),
    spec("Width", cellText("Entity width")),
    spec("Height", cellText("Entity height")),
    spec("Mass", cellText("Mass")),
    spec("Minimum Crew", cellText("Minimum crew")),
    spec("Maximum Crew", cellText("Maximum crew")),
    spec("Vehicle Inventory", cellText("Vehicle inventory")),
    spec("Cargo Capacity", cellText("Cargo capacity")),
    spec("SCM Speed", cellText("SCM speed")),
    spec("Maximum Speed", cellText("Maximum speed")),
    spec("Roll Rate", cellText("Roll rate")),
    spec("Pitch Rate", cellText("Pitch rate")),
    spec("Yaw Rate", cellText("Yaw rate")),
    spec("Concept Announcement Date", cellText("Concept announcement date"))
  ]);
  const manufacturerName = cellText("Manufacturer") || null;
  const manufacturer = resolveManufacturer(manufacturerName);

  return {
    name: rawName,
    pagePath,
    pageUrl: absoluteURL(pagePath),
    manufacturer: manufacturerName,
    manufacturerSlug: manufacturer.slug,
    career: cellText("Career") || null,
    role: cellText("Role") || null,
    size: cellText("Ship matrix size") || null,
    inGameStatus: cellText("Production state") || null,
    pledgeAvailability: cellText("Pledge availability") || null,
    minCrew: parseNullableInteger(cellText("Minimum crew")),
    maxCrew: parseNullableInteger(cellText("Maximum crew")),
    technicalSpecs
  };
}

async function buildSpviewerShipDetails(entries) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    serviceWorkers: "block",
    viewport: { width: 1440, height: 1400 }
  });

  await context.route("**/*", (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    const url = request.url();

    if (
      resourceType === "image" ||
      resourceType === "media" ||
      resourceType === "font" ||
      url.includes("fonts.googleapis.com") ||
      url.includes("fonts.gstatic.com") ||
      url.includes("data.spviewer.eu/js/script.js")
    ) {
      return route.abort();
    }

    return route.continue();
  });

  try {
    const spviewerIndex = await loadSpviewerVehicleIndex(context);
    const resolveVehicle = buildSpviewerVehicleResolver(spviewerIndex);
    const matchedEntries = entries.map((entry) => ({
      entry,
      vehicle: resolveVehicle(entry)
    }));
    const matchCount = matchedEntries.filter((item) => item.vehicle).length;
    console.log(`Matched ${matchCount}/${entries.length} ships to SPViewer vehicle pages`);

    const ships = await asyncPool(
      SPVIEWER_DETAIL_CONCURRENCY,
      matchedEntries,
      async ({ entry, vehicle }, index) => {
        if ((index + 1) % 25 === 0 || index === matchedEntries.length - 1) {
          console.log(`Resolving SPViewer ship detail pages ${index + 1}/${matchedEntries.length}`);
        }

        if (!vehicle) {
          return unavailableShip(entry, "No matching SPViewer vehicle entry");
        }

        try {
          const detailData = await scrapeSpviewerDetailPage(context, vehicle);
          return {
            ...entry,
            description: detailData.description,
            technicalSections: detailData.technicalSections,
            specificationSections: detailData.specificationSections,
            componentEntries: detailData.componentEntries,
            weaponsUtilityEntries: detailData.weaponsUtilityEntries,
            componentSummary: detailData.componentSummary,
            weaponsUtilitySummary: detailData.weaponsUtilitySummary,
            spviewerId: vehicle.id,
            spviewerName: vehicle.name,
            spviewerPageUrl: vehicle.pageUrl,
            unavailableReason: null
          };
        } catch (error) {
          return unavailableShip(
            entry,
            error instanceof Error ? error.message : String(error),
            vehicle
          );
        }
      }
    );

    return ships;
  } finally {
    await browser.close();
  }
}

async function loadSpviewerVehicleIndex(context) {
  const page = await context.newPage();

  try {
    await page.goto(SPVIEWER_ORIGIN, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });
    await page.waitForFunction(
      () => document.querySelectorAll(".ship[id]").length > 50,
      null,
      { timeout: 90_000 }
    );

    const vehicles = await page.evaluate((origin) => {
      const byId = new Map();
      const ignoredLabels = new Set([
        "search",
        "released",
        "concept",
        "production",
        "prod.on hold",
        "next patch"
      ]);

      for (const element of Array.from(document.querySelectorAll(".ship[id]"))) {
        const id = element.id;
        const name = element.textContent?.replace(/\s+/g, " ").trim() ?? "";

        if (!id || !name || ignoredLabels.has(name.toLowerCase())) {
          continue;
        }

        const existing = byId.get(id);
        if (!existing || name.length > existing.name.length) {
          byId.set(id, {
            id,
            name,
            pageUrl: `${origin}/performance?ship=${encodeURIComponent(id)}`
          });
        }
      }

      return Array.from(byId.values());
    }, SPVIEWER_ORIGIN);

    console.log(`Loaded ${vehicles.length} SPViewer performance vehicle index entries`);
    return vehicles;
  } finally {
    await page.close();
  }
}

function buildSpviewerVehicleResolver(vehicles) {
  const vehicleByKey = new Map();

  for (const vehicle of vehicles) {
    const keys = new Set([
      spviewerNameKey(vehicle.name),
      spviewerNameKey(stripSpviewerManufacturerPrefix(vehicle.name))
    ]);

    for (const key of keys) {
      if (key && !vehicleByKey.has(key)) {
        vehicleByKey.set(key, vehicle);
      }
    }
  }

  return (entry) => {
    for (const candidate of buildSpviewerNameCandidates(entry)) {
      const vehicle = vehicleByKey.get(spviewerNameKey(candidate));
      if (vehicle) {
        return vehicle;
      }
    }

    return null;
  };
}

function buildSpviewerNameCandidates(entry) {
  const candidates = new Set([entry.name]);
  const prefixes = SPVIEWER_MANUFACTURER_PREFIXES_BY_SLUG[entry.manufacturerSlug] ?? [];

  for (const prefix of prefixes) {
    candidates.add(`${prefix} ${entry.name}`);
  }

  if (entry.manufacturer) {
    candidates.add(`${entry.manufacturer} ${entry.name}`);
  }

  for (const alias of SPVIEWER_NAME_ALIASES[entry.name] ?? []) {
    candidates.add(alias);
  }

  return Array.from(candidates).filter(Boolean);
}

function stripSpviewerManufacturerPrefix(value) {
  const normalized = normalizeWhitespace(value);
  const prefixes = Object.values(SPVIEWER_MANUFACTURER_PREFIXES_BY_SLUG).flat();

  for (const prefix of prefixes.sort((left, right) => right.length - left.length)) {
    if (normalized.toLowerCase().startsWith(`${prefix.toLowerCase()} `)) {
      return normalized.slice(prefix.length + 1);
    }
  }

  return normalized;
}

function spviewerNameKey(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\bmk\s*1\b/g, "mk i")
    .replace(/\bmk\s*2\b/g, "mk ii")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|edition)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function scrapeSpviewerDetailPage(context, vehicle) {
  const page = await context.newPage();

  try {
    await page.goto(vehicle.pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });
    await page.waitForFunction(
      () => {
        const text = document.body.innerText || "";
        return text.includes("Hull") || text.includes("No vehicle") || text.includes("No hardpoint");
      },
      null,
      { timeout: 90_000 }
    );

    const lines = await page.evaluate(() =>
      document.body.innerText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    );

    return parseSpviewerDetailLines(vehicle, lines);
  } finally {
    await page.close();
  }
}

function parseSpviewerDetailLines(vehicle, rawLines) {
  const lines = rawLines.map(normalizeWhitespace).filter(Boolean);
  const technicalSections = extractSpviewerTechnicalSections(lines);
  const specificationSections = extractSpviewerSpecificationSections(lines);
  const componentSections = specificationSections.filter(
    (section) => !SPVIEWER_WEAPONS_TABS.has(section.title)
  );
  const weaponsUtilitySections = specificationSections.filter((section) =>
    SPVIEWER_WEAPONS_TABS.has(section.title)
  );

  return {
    description: extractSpviewerDescription(lines),
    technicalSections: [
      ...technicalSections,
      ...specificationSections.map(toLegacyTechnicalSection)
    ],
    specificationSections,
    componentEntries: flattenSectionItems(componentSections),
    weaponsUtilityEntries: flattenSectionItems(weaponsUtilitySections),
    componentSummary: buildSpecificationSummary(componentSections),
    weaponsUtilitySummary: buildSpecificationSummary(weaponsUtilitySections),
    sourceVehicle: vehicle
  };
}

function extractSpviewerDescription(lines) {
  return sanitizeDescription(
    lines.find((line) =>
      line.length >= 80 &&
      !line.startsWith("SC Ships Performances Viewer") &&
      !line.includes("This simulation is based on")
    )
  );
}

function extractSpviewerTechnicalSections(lines) {
  return SPVIEWER_TECHNICAL_SECTION_DEFINITIONS
    .map((definition) => {
      const items = extractSpviewerKnownLabelItems(lines, definition);
      return items.length ? { title: definition.title, items } : null;
    })
    .filter(Boolean);
}

function extractSpviewerKnownLabelItems(lines, definition) {
  const start = lines.indexOf(definition.title);
  if (start === -1) {
    return [];
  }

  const end = findNextLineIndex(lines, start + 1, [
    ...definition.endTitles,
    "POWER - COOLING - WEIGHT DISTRIBUTION",
    "Continuous fire info",
    "drag_indicator"
  ]);
  const labels = new Set(definition.labels);
  const boundaryLabels = new Set([...definition.labels, ...definition.endTitles]);
  const items = [];

  for (let index = start + 1; index < end; index += 1) {
    const label = lines[index];
    if (!labels.has(label)) {
      continue;
    }

    const valueParts = [];
    let cursor = index + 1;

    while (cursor < end && !boundaryLabels.has(lines[cursor]) && !isSpviewerHardBoundary(lines[cursor])) {
      if (!isSpviewerControlLine(lines[cursor])) {
        valueParts.push(lines[cursor]);
      }
      cursor += 1;
    }

    const value = normalizeWhitespace(valueParts.join(" "));
    if (value) {
      items.push({ label, value });
    }
  }

  return dedupeSpecs(items);
}

function extractSpviewerSpecificationSections(lines) {
  const sections = [];

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (lines[index] !== "drag_indicator") {
      continue;
    }

    const title = lines[index + 1];
    if (!SPVIEWER_LOADOUT_SECTION_TITLES.has(title)) {
      continue;
    }

    const next = findNextLineIndex(lines, index + 2, ["drag_indicator"]);
    const body = lines.slice(index + 2, next);
    const items = parseSpviewerLoadoutItems(body);

    if (items.length) {
      sections.push({
        tab: SPVIEWER_LOADOUT_TABS[title],
        title,
        items,
        summaryBySize: buildSectionSizeSummary(items)
      });
    }

    index = next - 1;
  }

  return sections;
}

function parseSpviewerLoadoutItems(sectionLines) {
  const lines = sectionLines.filter((line) => !isSpviewerControlLine(line));
  const items = [];
  let index = 0;

  while (index < lines.length) {
    const size = parseSpviewerSizeLabel(lines[index]);

    if (size) {
      const name = lines[index + 1];
      if (!name || isSpviewerControlLine(name) || isSpviewerNoDataLine(name)) {
        index += 1;
        continue;
      }

      const detailStart = index + 2;
      let detailEnd = detailStart;
      while (detailEnd < lines.length && !parseSpviewerSizeLabel(lines[detailEnd])) {
        if (SPVIEWER_SPECIAL_ITEM_NAMES.has(lines[detailEnd])) {
          break;
        }
        detailEnd += 1;
      }

      const details = lines.slice(detailStart, detailEnd).filter((line) => !isSpviewerNoDataLine(line));
      items.push(buildSpviewerLoadoutItem(name, size.label, details));
      index = detailEnd;
      continue;
    }

    if (SPVIEWER_SPECIAL_ITEM_NAMES.has(lines[index]) && !isSpviewerNoDataLine(lines[index + 1])) {
      const name = lines[index];
      const details = [];
      let detailEnd = index + 1;

      while (
        detailEnd < lines.length &&
        !parseSpviewerSizeLabel(lines[detailEnd]) &&
        !SPVIEWER_SPECIAL_ITEM_NAMES.has(lines[detailEnd])
      ) {
        details.push(lines[detailEnd]);
        detailEnd += 1;
      }

      items.push(buildSpviewerLoadoutItem(name, null, details));
      index = detailEnd;
      continue;
    }

    index += 1;
  }

  return items;
}

function buildSpviewerLoadoutItem(name, size, details) {
  const countAndSize = details.map(parseSpviewerCountAndSize).find(Boolean);
  const countLabel = details.find((line) => /^x\d+$/i.test(line)) ?? countAndSize?.countLabel ?? null;
  const normalizedCountLabel = countLabel?.startsWith("x")
    ? `${countLabel.slice(1)}x`
    : countLabel;
  const itemSize = size ?? countAndSize?.size ?? null;
  const subtitle = normalizeWhitespace(
    details
      .filter((line) => line !== countLabel && !parseSpviewerCountAndSize(line))
      .join(" · ")
  ) || null;

  return {
    name,
    internalName: null,
    countLabel: normalizedCountLabel,
    count: parseNullableInteger(normalizedCountLabel ?? ""),
    size: itemSize,
    sizeNumber: parseSizeNumber(itemSize),
    subtitle,
    level: null,
    pagePath: null,
    pageUrl: null
  };
}

function parseSpviewerSizeLabel(value) {
  const match = normalizeWhitespace(value).match(/^S(\d+)$/i);
  return match
    ? {
        label: `S${match[1]}`,
        sizeNumber: Number.parseInt(match[1], 10)
      }
    : null;
}

function parseSpviewerCountAndSize(value) {
  const match = normalizeWhitespace(value).match(/(\d+)x\s*S(\d+)/i);
  return match
    ? {
        countLabel: `${match[1]}x`,
        size: `S${match[2]}`
      }
    : null;
}

function unavailableShip(entry, reason, vehicle = null) {
  return {
    ...entry,
    description: null,
    technicalSections: [],
    specificationSections: [],
    componentEntries: [],
    weaponsUtilityEntries: [],
    componentSummary: emptySpecificationSummary(),
    weaponsUtilitySummary: emptySpecificationSummary(),
    spviewerId: vehicle?.id ?? null,
    spviewerName: vehicle?.name ?? null,
    spviewerPageUrl: vehicle?.pageUrl ?? null,
    unavailableReason: reason
  };
}

function findNextLineIndex(lines, start, targets) {
  const targetSet = new Set(targets);
  for (let index = start; index < lines.length; index += 1) {
    if (targetSet.has(lines[index])) {
      return index;
    }
  }

  return lines.length;
}

function isSpviewerControlLine(line) {
  return SPVIEWER_CONTROL_LINES.has(line);
}

function isSpviewerNoDataLine(line) {
  return !line || line === "No hardpoint" || line === "N/A";
}

function isSpviewerHardBoundary(line) {
  return line === "drag_indicator" || line === "POWER - COOLING - WEIGHT DISTRIBUTION";
}

function sanitizeDescription(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  return normalized
    .replace(/\[\d+\]/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseSizeNumber(size) {
  const matchedSize = size?.match(/^S(\d+)$/i);
  return matchedSize ? Number.parseInt(matchedSize[1], 10) : null;
}

function toLegacyTechnicalSection(section) {
  return {
    title: section.title || "Components",
    items: section.items.map((item) => ({
      label: item.name || "Component",
      value: legacyValueForItem(item)
    }))
  };
}

function legacyValueForItem(item) {
  const value = normalizeWhitespace(
    [item.countLabel, item.size, item.internalName, item.subtitle].filter(Boolean).join(" · ")
  );
  return value || null;
}

function flattenSectionItems(sections) {
  return sections.flatMap((section) =>
    section.items.map((item) => ({
      tab: section.tab,
      section: section.title,
      ...item
    }))
  );
}

function buildSpecificationSummary(sections) {
  const entries = flattenSectionItems(sections);

  return {
    totalEntries: entries.length,
    totalCount: entries.reduce((sum, entry) => sum + effectiveItemCount(entry), 0),
    bySection: sections.flatMap((section) =>
      section.summaryBySize.map((summary) => ({
        tab: section.tab,
        section: section.title,
        ...summary
      }))
    ),
    bySize: buildSizeSummary(entries)
  };
}

function buildSectionSizeSummary(items) {
  return buildSizeSummary(items);
}

function buildSizeSummary(entries) {
  const grouped = new Map();

  for (const entry of entries) {
    const key = entry.size || "Unknown";
    const current =
      grouped.get(key) ?? {
        size: entry.size || null,
        sizeNumber: entry.sizeNumber ?? null,
        count: 0,
        entryCount: 0
      };

    current.count += effectiveItemCount(entry);
    current.entryCount += 1;

    if (current.sizeNumber === null && entry.sizeNumber !== null) {
      current.sizeNumber = entry.sizeNumber;
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort(compareSizeSummary);
}

function compareSizeSummary(left, right) {
  if (left.sizeNumber !== null && right.sizeNumber !== null && left.sizeNumber !== right.sizeNumber) {
    return left.sizeNumber - right.sizeNumber;
  }

  if (left.sizeNumber !== null) {
    return -1;
  }

  if (right.sizeNumber !== null) {
    return 1;
  }

  return (left.size || "").localeCompare(right.size || "");
}

function effectiveItemCount(entry) {
  return typeof entry.count === "number" && Number.isFinite(entry.count) ? entry.count : 1;
}

function emptySpecificationSummary() {
  return {
    totalEntries: 0,
    totalCount: 0,
    bySection: [],
    bySize: []
  };
}

function dedupeSpecs(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.label}:::${item.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function spec(label, value) {
  if (!label || !value) {
    return null;
  }

  return { label, value };
}

function compactSpecs(items) {
  return items.filter(Boolean);
}

function appendSyntheticShipDetailAliases(ships) {
  const existingNames = new Set(ships.map((ship) => ship.name));

  for (const alias of SYNTHETIC_SHIP_DETAIL_ALIASES) {
    if (existingNames.has(alias.name)) {
      continue;
    }

    const sourceShip = ships.find((ship) => ship.name === alias.sourceName);
    if (!sourceShip) {
      continue;
    }

    ships.push({
      ...sourceShip,
      name: alias.name
    });
    existingNames.add(alias.name);
  }

  return ships;
}

function normalizeWhitespace(value) {
  if (!value) {
    return "";
  }

  return value
    .replace(/\u00A0/g, " ")
    .replace(/\u202F/g, " ")
    .replace(/\u2764\uFE0F?/g, "HP")
    .replace(/\u{1F5E1}\uFE0F?/gu, "damage")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNullableInteger(value) {
  const normalized = value.replace(/[^0-9]/g, "");
  return normalized ? Number.parseInt(normalized, 10) : null;
}

function absoluteURL(pathname) {
  return new URL(pathname, SITE_ORIGIN).toString();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading ${url}`);
  }

  return response.text();
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function asyncPool(limit, items, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

await main();
