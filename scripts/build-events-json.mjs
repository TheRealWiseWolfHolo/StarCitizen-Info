import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { chromium } from "playwright";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const officialEventsPath = path.join(repositoryRoot, "data/events/official-events.json");
const outputPath = path.join(repositoryRoot, "docs/events.json");
const barCitizenListURL = "https://www.barcitizen.org/eventlist";
const sourceTimeoutMilliseconds = 30_000;
const maximumBarCitizenDurationMilliseconds = 7 * 24 * 60 * 60 * 1_000;

const timeZoneOffsets = new Map([
  ["UTC", "+00:00"], ["GMT", "+00:00"],
  ["GMT+1", "+01:00"], ["GMT+2", "+02:00"], ["GMT+3", "+03:00"], ["GMT+8", "+08:00"],
  ["BST", "+01:00"], ["CET", "+01:00"], ["CEST", "+02:00"],
  ["EST", "-05:00"], ["EDT", "-04:00"], ["CST", "-06:00"], ["CDT", "-05:00"],
  ["MST", "-07:00"], ["MDT", "-06:00"], ["PST", "-08:00"], ["PDT", "-07:00"],
]);

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeURL(value, baseURL = barCitizenListURL) {
  try {
    const url = new URL(value, baseURL);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function stableEventID(prefix, sourceURL) {
  const normalized = normalizeURL(sourceURL);
  if (!normalized) {
    throw new Error(`Cannot create an event ID from invalid URL: ${sourceURL}`);
  }
  const slug = new URL(normalized).pathname.split("/").filter(Boolean).at(-1);
  const safeSlug = slug?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (safeSlug) {
    return `${prefix}:${safeSlug}`;
  }
  return `${prefix}:${createHash("sha256").update(normalized).digest("hex").slice(0, 16)}`;
}

function isoDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
}

export function validateEvent(event) {
  const errors = [];
  if (!event || typeof event !== "object") errors.push("event must be an object");
  if (!cleanText(event?.id)) errors.push("id is required");
  if (!cleanText(event?.title)) errors.push("title is required");
  if (!["official", "barCitizen"].includes(event?.category)) errors.push("category is invalid");
  if (!["scheduled", "cancelled", "postponed", "completed"].includes(event?.status)) errors.push("status is invalid");
  if (!["cigPublished", "communityPublished"].includes(event?.verification)) errors.push("verification is invalid");
  if (!event?.schedule || !["timed", "allDay"].includes(event.schedule.kind)) {
    errors.push("schedule.kind is invalid");
  } else if (event.schedule.kind === "timed") {
    const start = Date.parse(event.schedule.startsAt);
    const end = Date.parse(event.schedule.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      errors.push("timed schedule must use RFC 3339 dates");
    } else {
      if (end <= start) errors.push("timed schedule must end after it starts");
      if (event.category === "barCitizen" && end - start > maximumBarCitizenDurationMilliseconds) {
        errors.push("Bar Citizen event duration exceeds seven days");
      }
    }
  } else {
    if (!isoDateOnly(event.schedule.startDate) || !isoDateOnly(event.schedule.endDateExclusive)) {
      errors.push("all-day schedule must use YYYY-MM-DD dates");
    } else if (event.schedule.endDateExclusive <= event.schedule.startDate) {
      errors.push("all-day schedule must end after it starts");
    }
  }
  if (!Array.isArray(event?.links) || !event.links.some((link) => link.role === "source" && normalizeURL(link.url))) {
    errors.push("a valid source link is required");
  }
  return errors;
}

function dateValue(event) {
  return event.schedule.kind === "timed"
    ? Date.parse(event.schedule.startsAt)
    : Date.parse(`${event.schedule.startDate}T00:00:00Z`);
}

function normalizeJSONLDNodes(value) {
  if (Array.isArray(value)) return value.flatMap(normalizeJSONLDNodes);
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value["@graph"])) return normalizeJSONLDNodes(value["@graph"]);
  return [value];
}

function eventJSONLD($) {
  const nodes = [];
  $("script[type='application/ld+json']").each((_, element) => {
    try {
      nodes.push(...normalizeJSONLDNodes(JSON.parse($(element).text())));
    } catch {
      // Ignore unrelated malformed structured data and use the visible-page fallback.
    }
  });
  return nodes.find((node) => {
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
    return types.includes("Event");
  });
}

function toISOWithOffset(dateText, timeText, zoneText) {
  const match = cleanText(dateText).match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/);
  const time = cleanText(timeText).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const offset = timeZoneOffsets.get(cleanText(zoneText).toUpperCase());
  if (!match || !time || !offset) return null;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(match[1]) + 1;
  if (month === 0) return null;
  let hour = Number(time[1]) % 12;
  if (time[3].toUpperCase() === "PM") hour += 12;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}T${String(hour).padStart(2, "0")}:${time[2]}:00${offset}`;
}

function visibleSchedule(text) {
  const pattern = /([A-Z][a-z]{2} \d{1,2}, \d{4}), (\d{1,2}:\d{2} [AP]M)(?: ([A-Z]{2,5}|GMT[+-]\d{1,2}))? (?:–|-)\s*(?:([A-Z][a-z]{2} \d{1,2}, \d{4}), )?(\d{1,2}:\d{2} [AP]M) ([A-Z]{2,5}|GMT[+-]\d{1,2})/;
  const match = cleanText(text).match(pattern);
  if (!match) return null;
  const startZone = match[3] || match[6];
  const startsAt = toISOWithOffset(match[1], match[2], startZone);
  const endsAt = toISOWithOffset(match[4] || match[1], match[5], match[6]);
  if (!startsAt || !endsAt) return null;
  return { kind: "timed", startsAt, endsAt, timeZone: match[6], originalTimeZone: match[6] };
}

function locationFromJSONLD(location) {
  if (!location || typeof location !== "object") return { isOnline: false };
  const address = location.address;
  const formattedAddress = typeof address === "string"
    ? cleanText(address)
    : cleanText([
      address?.streetAddress,
      address?.addressLocality,
      address?.addressRegion,
      address?.postalCode,
      address?.addressCountry,
    ].filter(Boolean).join(", "));
  return {
    isOnline: false,
    name: cleanText(location.name) || null,
    city: cleanText(address?.addressLocality) || null,
    region: cleanText(address?.addressRegion) || null,
    countryCode: cleanText(address?.addressCountry) || null,
    formattedAddress: formattedAddress || null,
  };
}

export function parseBarCitizenDetail(html, sourceURL, verifiedAt = new Date().toISOString()) {
  const $ = cheerio.load(html);
  const structured = eventJSONLD($);
  const mainText = cleanText($("main").text() || $("body").text());
  const heading = cleanText($("h1").first().text());
  const title = cleanText(structured?.name) || heading;
  const startsAt = structured?.startDate && Number.isFinite(Date.parse(structured.startDate))
    ? structured.startDate
    : null;
  const endsAt = structured?.endDate && Number.isFinite(Date.parse(structured.endDate))
    ? structured.endDate
    : null;
  const structuredTimeZone = cleanText(structured?.eventSchedule?.scheduleTimezone)
    || cleanText(structured?.startDate).match(/(Z|[+-]\d{2}:\d{2})$/)?.[1]
    || null;
  const schedule = startsAt && endsAt
    ? {
      kind: "timed",
      startsAt,
      endsAt,
      timeZone: structuredTimeZone,
      originalTimeZone: structuredTimeZone,
    }
    : visibleSchedule(mainText);
  if (!title || !schedule) {
    throw new Error("detail page is missing a title or parseable schedule");
  }
  const visibleLocation = cleanText(
    $("h2").filter((_, element) => /time\s*&\s*location/i.test($(element).text())).first().nextAll().first().text(),
  );
  const location = structured?.location
    ? locationFromJSONLD(structured.location)
    : { isOnline: false, formattedAddress: visibleLocation || null };
  const description = cleanText(structured?.description || "");
  return {
    id: stableEventID("barcitizen", sourceURL),
    title,
    category: "barCitizen",
    eventType: "inPerson",
    organizer: "Bar Citizens International",
    verification: "communityPublished",
    status: structured?.eventStatus?.includes("Cancelled") ? "cancelled" : "scheduled",
    schedule,
    location,
    summary: description ? description.slice(0, 280) : "Meet local Star Citizen players at a community-organized Bar Citizen.",
    links: [
      { role: "source", label: "Event details and RSVP", url: normalizeURL(sourceURL) },
    ],
    lastVerifiedAt: verifiedAt,
  };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sourceTimeoutMilliseconds);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "StarCitizen-Info event feed builder (+https://github.com/TheRealWiseWolfHolo/StarCitizen-Info)" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCompleteBarCitizenListHTML() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: "StarCitizen-Info event feed builder (+https://github.com/TheRealWiseWolfHolo/StarCitizen-Info)",
    });
    await page.goto(barCitizenListURL, {
      waitUntil: "domcontentloaded",
      timeout: sourceTimeoutMilliseconds,
    });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const loadMore = page
        .locator("button, a")
        .filter({ hasText: /^\s*load more\s*$/i })
        .last();
      if (await loadMore.count() === 0 || !(await loadMore.isVisible())) break;

      const before = await page.locator("a[href*='/event-details/']").count();
      await loadMore.click({ timeout: 10_000 });
      await page.waitForFunction(
        (previousCount) => document.querySelectorAll("a[href*='/event-details/']").length > previousCount,
        before,
        { timeout: 10_000 },
      ).catch(() => {});
      const after = await page.locator("a[href*='/event-details/']").count();
      if (after <= before) break;
    }

    return await page.content();
  } catch (error) {
    console.warn(`Browser expansion failed; using the server-rendered Bar Citizen list: ${error.message}`);
    return await fetchText(barCitizenListURL);
  } finally {
    await browser?.close();
  }
}

export function discoverBarCitizenLinks(html) {
  const $ = cheerio.load(html);
  return [...new Set(
    $("a[href*='/event-details/']")
      .map((_, element) => normalizeURL($(element).attr("href")))
      .get()
      .filter((value) => {
        if (!value) return false;
        const url = new URL(value);
        return url.hostname === "www.barcitizen.org" && url.pathname.startsWith("/event-details/");
      }),
  )].sort();
}

async function loadPreviousFeed() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    return null;
  }
}

async function fetchBarCitizenEvents(generatedAt) {
  const listHTML = await fetchCompleteBarCitizenListHTML();
  const links = discoverBarCitizenLinks(listHTML);
  if (links.length === 0) throw new Error("event list did not contain any event detail links");
  const results = await Promise.allSettled(links.map(async (url) => {
    const html = await fetchText(url);
    return parseBarCitizenDetail(html, url, generatedAt);
  }));
  const events = [];
  const quarantined = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result.status === "rejected") {
      quarantined.push({ sourceURL: links[index], reasons: [result.reason?.message ?? String(result.reason)] });
      continue;
    }
    const errors = validateEvent(result.value);
    if (errors.length > 0) quarantined.push({ sourceURL: links[index], reasons: errors });
    else events.push(result.value);
  }
  if (events.length === 0) throw new Error("all discovered Bar Citizen events failed validation");
  return { events, quarantined, discoveredCount: links.length };
}

function mergeEvents(events) {
  const byID = new Map();
  for (const event of events) {
    const existing = byID.get(event.id);
    if (!existing || Date.parse(event.lastVerifiedAt) >= Date.parse(existing.lastVerifiedAt)) {
      byID.set(event.id, event);
    }
  }
  return [...byID.values()].sort((left, right) => dateValue(left) - dateValue(right) || left.title.localeCompare(right.title));
}

export async function buildEventsFeed() {
  const generatedAt = new Date().toISOString();
  const curated = JSON.parse(await readFile(officialEventsPath, "utf8"));
  const officialEvents = curated.events ?? [];
  const officialErrors = officialEvents.flatMap((event) => validateEvent(event).map((reason) => `${event.id || "unknown"}: ${reason}`));
  if (officialErrors.length > 0) {
    throw new Error(`Official event validation failed:\n${officialErrors.join("\n")}`);
  }

  const previousFeed = await loadPreviousFeed();
  let barCitizen;
  let sourceStatus;
  if (process.env.EVENTS_SKIP_REMOTE === "1") {
    barCitizen = {
      events: previousFeed?.events?.filter((event) => event.category === "barCitizen") ?? [],
      quarantined: [],
      discoveredCount: 0,
    };
    sourceStatus = { status: "skipped", usedPreviousData: barCitizen.events.length > 0, message: "Remote refresh skipped by environment." };
  } else {
    try {
      barCitizen = await fetchBarCitizenEvents(generatedAt);
      sourceStatus = { status: "fresh", usedPreviousData: false, message: null };
    } catch (error) {
      const previousEvents = previousFeed?.events?.filter((event) => event.category === "barCitizen") ?? [];
      if (previousEvents.length === 0) throw error;
      barCitizen = { events: previousEvents, quarantined: [], discoveredCount: 0 };
      sourceStatus = { status: "fallback", usedPreviousData: true, message: error.message };
    }
  }

  const events = mergeEvents([...officialEvents, ...barCitizen.events]);
  const output = {
    schemaVersion: 1,
    generatedAt,
    count: events.length,
    sources: [
      {
        id: "cig",
        name: "Cloud Imperium Games",
        url: "https://robertsspaceindustries.com/en/comm-link",
        status: "curated",
        usedPreviousData: false,
      },
      {
        id: "barCitizen",
        name: "Bar Citizens International",
        url: barCitizenListURL,
        status: sourceStatus.status,
        usedPreviousData: sourceStatus.usedPreviousData,
        message: sourceStatus.message,
        discoveredCount: barCitizen.discoveredCount,
        quarantinedCount: barCitizen.quarantined.length,
      },
    ],
    events,
    quarantine: barCitizen.quarantined,
  };

  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Published ${events.length} events to docs/events.json (${barCitizen.quarantined.length} quarantined).`);
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildEventsFeed();
}
