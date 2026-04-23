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
        unavailableReason: null
      };
    } catch (error) {
      return {
        ...entry,
        description: null,
        technicalSections: [],
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

    const componentSections = extractComponentSections($, section);
    technicalSections.push(...componentSections);
  }

  return {
    description,
    technicalSections
  };
}

function extractDescription($) {
  const paragraphCandidates = $("main p")
    .toArray()
    .map((element) => normalizeWhitespace($(element).text()))
    .filter((text) => text.length >= 80);

  if (paragraphCandidates.length) {
    return paragraphCandidates[0];
  }

  return normalizeWhitespace($('meta[name="description"]').attr("content")) || null;
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

function extractComponentSections($, section) {
  const technicalSections = [];

  section.find(".template-components__section").each((_, element) => {
    const componentSection = $(element);
    const title = normalizeWhitespace(componentSection.find(".template-components__label").first().text());
    const items = componentSection
      .find(".template-component__card")
      .map((_, cardElement) => {
        const card = $(cardElement);
        const count = normalizeWhitespace(card.find(".template-component__count").first().text());
        const size = normalizeWhitespace(card.find(".template-component__size").first().text());
        const cardTitle = cleanComponentTitle(
          normalizeWhitespace(card.find(".template-component__title").first().text())
        );
        const subtitle = normalizeWhitespace(card.find(".template-component__subtitle").first().text());

        if (!cardTitle && !subtitle && !count && !size) {
          return null;
        }

        const valueParts = [count, size, subtitle].filter(Boolean);
        return {
          label: cardTitle || "Component",
          value: valueParts.join(" · ").nilIfBlank ?? null
        };
      })
      .get()
      .filter(Boolean)
      .map((item) => ({
        label: item.label,
        value: item.value
      }));

    if (items.length) {
      technicalSections.push({
        title: title || "Components",
        items
      });
    }
  });

  return technicalSections;
}

function cleanComponentTitle(rawTitle) {
  if (!rawTitle) {
    return null;
  }

  const matchedSuffix = rawTitle.match(/^(.*?)([a-z]{2,}_[A-Za-z0-9_]+)$/);
  if (matchedSuffix && matchedSuffix[1]) {
    return normalizeWhitespace(matchedSuffix[1]);
  }

  return rawTitle;
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

Object.defineProperty(String.prototype, "nilIfBlank", {
  value() {
    const trimmed = this.trim();
    return trimmed.length ? trimmed : null;
  },
  enumerable: false
});

await main();
