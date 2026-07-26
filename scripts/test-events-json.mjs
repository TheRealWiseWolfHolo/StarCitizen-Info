import assert from "node:assert/strict";
import {
  discoverBarCitizenLinks,
  parseBarCitizenDetail,
  projectAnticipatedEvent,
  stableEventID,
  validateEvent,
} from "./build-events-json.mjs";

const sourceURL = "https://www.barcitizen.org/event-details/pax-west-2026-bar-citizen?utm_source=test";
assert.equal(stableEventID("barcitizen", sourceURL), "barcitizen:pax-west-2026-bar-citizen");

const links = discoverBarCitizenLinks(`
  <a href="/event-details/one">One</a>
  <a href="https://www.barcitizen.org/event-details/one">Duplicate</a>
  <a href="/event-details/two">Two</a>
`);
assert.deepEqual(links, [
  "https://www.barcitizen.org/event-details/one",
  "https://www.barcitizen.org/event-details/two",
]);

const event = parseBarCitizenDetail(`
  <html><body><main>
    <h1>PAX West 2026 Bar Citizen</h1>
    <h2>Time &amp; Location</h2>
    <p>Sep 04, 2026, 6:00 PM – 9:00 PM PDT</p>
    <p>Stoup Brewery, Seattle, WA, USA</p>
  </main></body></html>
`, sourceURL, "2026-07-26T00:00:00.000Z");
assert.equal(event.title, "PAX West 2026 Bar Citizen");
assert.equal(event.schedule.startsAt, "2026-09-04T18:00:00-07:00");
assert.equal(event.schedule.endsAt, "2026-09-04T21:00:00-07:00");
assert.deepEqual(validateEvent(event), []);

const suspicious = structuredClone(event);
suspicious.schedule.endsAt = "2028-09-04T21:00:00-07:00";
assert(validateEvent(suspicious).includes("Bar Citizen event duration exceeds seven days"));

const anticipated = projectAnticipatedEvent({
  seriesID: "red-festival",
  title: "Red Festival",
  startMonthDay: "01-29",
  endMonthDayExclusive: "02-18",
  sourceURL: "https://robertsspaceindustries.com/en/comm-link/transmission/example",
}, 2025, "2026-07-26T00:00:00.000Z");
assert.equal(anticipated.id, "anticipated:red-festival:2027");
assert.equal(anticipated.schedule.startDate, "2027-01-29");
assert.equal(anticipated.schedule.endDateExclusive, "2027-02-18");
assert.equal(anticipated.dateConfidence, "anticipated");
assert.deepEqual(validateEvent(anticipated), []);

console.log("Event feed tests passed.");
