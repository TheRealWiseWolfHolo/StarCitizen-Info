import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsDir = path.resolve(__dirname, "..", "docs");
const outputPath = path.join(docsDir, "ship-details.json");

const LIST_URL = "https://starcitizen.tools/List_of_pledge_vehicles";
const SITE_ORIGIN = "https://starcitizen.tools";
const DETAIL_CONCURRENCY = 8;

const DETAIL_TAB_IDS = [
  { id: "tabber-Hull", title: "Hull" },
  { id: "tabber-Speed", title: "Speed" },
  { id: "tabber-Fuel", title: "Fuel" },
  { id: "tabber-Avionics & Systems", title: "Avionics & Systems" },
  { id: "tabber-Propulsion & Thrusters", title: "Propulsion & Thrusters" },
  { id: "tabber-Weapons & Utility", title: "Weapons & Utility" },
  { id: "tabber-Cargo & Facilities", title: "Cargo & Facilities" },
  { id: "tabber-Vehicle part", title: "Vehicle Part" }
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

const FRIENDLY_HULL_LABELS = {
  "💪": "Physical Damage Resistance",
  "⚡": "Energy Damage Resistance",
  "〰️": "Distortion Damage Resistance",
  "🔥": "Thermal Damage Resistance",
  "☣️": "Biochemical Damage Resistance",
  "💫": "Stun Damage Resistance",
  CS: "Cross Section Signature",
  EM: "Electromagnetic Signature",
  IR: "Infrared Signature"
};

async function main() {
  console.log(`Fetching vehicle list from ${LIST_URL}`);
  const listHTML = await fetchText(LIST_URL);
  const ships = await buildShipDetails(listHTML);

  const payload = {
    generatedAt: new Date().toISOString(),
    sourcePageUrl: LIST_URL,
    shipCount: ships.length,
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

  return asyncPool(DETAIL_CONCURRENCY, baseEntries, async (entry, index) => {
    if ((index + 1) % 25 === 0 || index === baseEntries.length - 1) {
      console.log(`Resolving ship detail pages ${index + 1}/${baseEntries.length}`);
    }

    try {
      const detailHTML = await fetchText(entry.pageUrl);
      const detailData = parseDetailPage(detailHTML);
      return {
        ...entry,
        description: detailData.description,
        technicalSections: detailData.technicalSections,
        specificationSections: detailData.specificationSections,
        componentEntries: detailData.componentEntries,
        weaponsUtilityEntries: detailData.weaponsUtilityEntries,
        componentSummary: detailData.componentSummary,
        weaponsUtilitySummary: detailData.weaponsUtilitySummary,
        unavailableReason: null
      };
    } catch (error) {
      return {
        ...entry,
        description: null,
        technicalSections: [],
        specificationSections: [],
        componentEntries: [],
        weaponsUtilityEntries: [],
        componentSummary: emptySpecificationSummary(),
        weaponsUtilitySummary: emptySpecificationSummary(),
        unavailableReason: error instanceof Error ? error.message : String(error)
      };
    }
  });
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

  return {
    name: rawName,
    pagePath,
    pageUrl: absoluteURL(pagePath),
    manufacturer: cellText("Manufacturer") || null,
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

function parseDetailPage(html) {
  const $ = cheerio.load(html);
  const description = extractDescription($);
  const technicalSections = [];
  const specificationSections = [];

  for (const { id, title } of DETAIL_TAB_IDS) {
    const section = $(`[id="${id}"]`);
    if (!section.length) {
      continue;
    }

    const infoboxItems = extractInfoboxItems($, section);
    if (infoboxItems.length) {
      technicalSections.push({
        title,
        items: infoboxItems
      });
    }

    const componentSections = extractComponentSections($, section, title);
    specificationSections.push(...componentSections);
    technicalSections.push(...componentSections.map(toLegacyTechnicalSection));
  }

  const componentSections = specificationSections.filter(
    (section) => section.tab !== "Weapons & Utility"
  );
  const weaponsUtilitySections = specificationSections.filter(
    (section) => section.tab === "Weapons & Utility"
  );

  return {
    description,
    technicalSections,
    specificationSections,
    componentEntries: flattenSectionItems(componentSections),
    weaponsUtilityEntries: flattenSectionItems(weaponsUtilitySections),
    componentSummary: buildSpecificationSummary(componentSections),
    weaponsUtilitySummary: buildSpecificationSummary(weaponsUtilitySections)
  };
}

function extractDescription($) {
  const paragraphCandidates = $("main p")
    .toArray()
    .map((element) => normalizeWhitespace($(element).text()))
    .filter((text) => text.length >= 80);

  if (paragraphCandidates.length) {
    return sanitizeDescription(paragraphCandidates[0]);
  }

  return sanitizeDescription($('meta[name="description"]').attr("content"));
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

function extractInfoboxItems($, section) {
  const items = [];

  section.find(".infobox__item").each((_, element) => {
    const item = $(element);
    const rawLabel = normalizeWhitespace(item.find(".infobox__label").first().text());
    const value = normalizeWhitespace(item.find(".infobox__data").first().text());
    if (!value) {
      return;
    }

    let label = rawLabel;
    const tooltipData = normalizeWhitespace(
      item
        .closest(".ext-floatingui-reference")
        .next(".ext-floatingui-content")
        .find(".t-floatingui-data")
        .first()
        .text()
    );

    if (tooltipData) {
      label = tooltipData;
    } else if (FRIENDLY_HULL_LABELS[rawLabel]) {
      label = FRIENDLY_HULL_LABELS[rawLabel];
    }

    items.push({
      label: label || "Value",
      value
    });
  });

  return dedupeSpecs(items);
}

function extractComponentSections($, section, tabTitle) {
  const specificationSections = [];

  section.find(".template-components__section").each((_, element) => {
    const componentSection = $(element);
    const title = normalizeWhitespace(componentSection.find(".template-components__label").first().text());
    const items = componentSection
      .find(".template-component")
      .map((_, componentElement) => parseComponentItem($, componentElement))
      .get()
      .filter(Boolean);

    if (items.length) {
      specificationSections.push({
        tab: tabTitle,
        title: title || "Components",
        items,
        summaryBySize: buildSectionSizeSummary(items)
      });
    }
  });

  return specificationSections;
}

function parseComponentItem($, componentElement) {
  const component = $(componentElement);
  const card = component.find(".template-component__card").first();

  if (!card.length) {
    return null;
  }

  const titleContainer = card.find(".template-component__title").first();
  const countLabel = normalizeWhitespace(card.find(".template-component__count").first().text()) || null;
  const size = normalizeWhitespace(card.find(".template-component__size").first().text()) || null;
  const internalName =
    normalizeWhitespace(titleContainer.find(".template-component__title-subtext").first().text()) || null;
  const name = extractComponentName(titleContainer);
  const subtitle = normalizeWhitespace(card.find(".template-component__subtitle").first().text()) || null;
  const link = titleContainer.find("a").first();
  const pagePath = extractWikiPagePath(link.attr("href"));

  if (!name && !internalName && !countLabel && !size && !subtitle) {
    return null;
  }

  return {
    name: name || internalName || "Component",
    internalName,
    countLabel,
    count: parseNullableInteger(countLabel),
    size,
    sizeNumber: parseSizeNumber(size),
    subtitle,
    level: parseComponentLevel(component.attr("class") || ""),
    pagePath,
    pageUrl: pagePath ? absoluteURL(pagePath) : null
  };
}

function extractComponentName(titleContainer) {
  if (!titleContainer?.length) {
    return null;
  }

  const clone = titleContainer.clone();
  clone.find(".template-component__title-subtext").remove();
  return normalizeWhitespace(clone.text()) || null;
}

function extractWikiPagePath(href) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN) {
      return null;
    }

    if (
      url.pathname === "/index.php" &&
      url.searchParams.get("action") === "edit" &&
      url.searchParams.get("redlink") === "1"
    ) {
      return null;
    }

    return `${url.pathname}${url.search}` || null;
  } catch {
    return null;
  }
}

function parseComponentLevel(className) {
  const matchedLevel = className.match(/template-component--level-(\d+)/);
  return matchedLevel ? Number.parseInt(matchedLevel[1], 10) : null;
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

function normalizeWhitespace(value) {
  if (!value) {
    return "";
  }

  return value
    .replace(/\u00A0/g, " ")
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
