import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = path.join(repositoryRoot, "docs");

const defaultBaseUrls = [
  "https://starcitizen-info.pages.dev",
  "https://therealwisewolfholo.github.io/StarCitizen-Info",
];

const baseUrls = (process.env.PUBLISHED_DOCS_BASE_URLS ?? defaultBaseUrls.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const topLevelFiles = [
  "index.html",
  "ships.json",
  "ship-details.json",
  "limited-ships.json",
  "resource-manifest.json",
];

function urlFor(baseUrl, relativePath) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(relativePath, base);
}

async function fetchPublishedFile(relativePath) {
  const errors = [];

  for (const baseUrl of baseUrls) {
    const url = urlFor(baseUrl, relativePath);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = Buffer.from(await response.arrayBuffer());
      return { data, url: url.toString() };
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  throw new Error(`Unable to hydrate ${relativePath} from published feeds:\n${errors.join("\n")}`);
}

async function writeDocsFile(relativePath, data) {
  const destination = path.join(docsRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, data);
}

function addMediaPath(candidate, mediaPaths) {
  if (typeof candidate !== "string") {
    return;
  }

  let value = candidate.trim();
  if (!value) {
    return;
  }

  try {
    value = new URL(value).pathname;
  } catch {
    // The value is already a relative path or a larger string that may contain one.
  }

  value = value
    .replace(/^\/+/, "")
    .replace(/^StarCitizen-Info\//, "");

  const mediaIndex = value.indexOf("media/");
  if (mediaIndex === -1) {
    return;
  }

  const mediaPath = value
    .slice(mediaIndex)
    .split(/[?#]/, 1)[0]
    .replace(/[),.;'"]+$/, "");

  if (mediaPath.startsWith("media/")) {
    mediaPaths.add(mediaPath);
  }
}

function collectMediaPaths(value, mediaPaths) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectMediaPaths(item, mediaPaths);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectMediaPaths(item, mediaPaths);
    }
    return;
  }

  addMediaPath(value, mediaPaths);
}

async function hydrateTopLevelFiles() {
  const mediaPaths = new Set();

  for (const file of topLevelFiles) {
    const { data, url } = await fetchPublishedFile(file);
    await writeDocsFile(file, data);
    console.log(`Hydrated ${file} from ${url}`);

    if (file.endsWith(".json")) {
      const parsed = JSON.parse(data.toString("utf8"));
      collectMediaPaths(parsed, mediaPaths);
    }
  }

  return mediaPaths;
}

async function hydrateReferencedMedia(mediaPaths) {
  let hydrated = 0;

  for (const mediaPath of [...mediaPaths].sort()) {
    const { data, url } = await fetchPublishedFile(mediaPath);
    await writeDocsFile(mediaPath, data);
    hydrated += 1;
    console.log(`Hydrated ${mediaPath} from ${url}`);
  }

  console.log(`Hydrated ${hydrated} referenced media assets.`);
}

await mkdir(docsRoot, { recursive: true });

if (baseUrls.length === 0) {
  throw new Error("PUBLISHED_DOCS_BASE_URLS did not contain any usable base URLs.");
}

const mediaPaths = await hydrateTopLevelFiles();
await hydrateReferencedMedia(mediaPaths);

console.log(`Hydrated docs from published feeds. Referenced media assets: ${mediaPaths.size}.`);
