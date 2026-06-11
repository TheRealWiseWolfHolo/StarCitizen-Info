import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const supportedLocales = ["zh-Hans"];

function normalizeLookupKey(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

function requireString(value, field, context) {
  if (typeof value !== "string") {
    throw new Error(`${context} must include string field ${field}.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${context} field ${field} must not be empty.`);
  }

  return normalized;
}

function optionalString(value, field, context) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new Error(`${context} field ${field} must be a string when present.`);
  }

  return value.trim();
}

function validateAliases(value, context) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${context} aliases must be an array when present.`);
  }

  return value.map((alias, index) => requireString(alias, `aliases[${index}]`, context));
}

function validateEntry(entry, index, seenKeys) {
  const context = `entries[${index}]`;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`${context} must be an object.`);
  }

  const source = requireString(entry.source, "source", context);
  const translation = optionalString(entry.translation, "translation", context);
  const kind = requireString(entry.kind, "kind", context);
  const aliases = validateAliases(entry.aliases, context);

  for (const keySource of [source, ...aliases]) {
    const key = normalizeLookupKey(keySource);
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate translation key: ${keySource}.`);
    }
    seenKeys.add(key);
  }

  return {
    source,
    translation,
    kind,
    aliases
  };
}

function validatePayload(payload, expectedLocale) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${expectedLocale} translation source must be an object.`);
  }

  const locale = requireString(payload.locale, "locale", expectedLocale);
  if (locale !== expectedLocale) {
    throw new Error(`Expected locale ${expectedLocale}, received ${locale}.`);
  }

  if (!Number.isInteger(payload.version) || payload.version <= 0) {
    throw new Error(`${expectedLocale} version must be a positive integer.`);
  }

  if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
    throw new Error(`${expectedLocale} entries must be a non-empty array.`);
  }

  const seenKeys = new Set();
  const entries = payload.entries.map((entry, index) => validateEntry(entry, index, seenKeys));

  return {
    locale,
    version: payload.version,
    entries
  };
}

async function buildLocale(locale) {
  const sourcePath = path.join(projectRoot, "data", "item-translations", `${locale}.json`);
  const outputPath = path.join(projectRoot, "docs", "item-translations", `${locale}.json`);
  const payload = JSON.parse(await readFile(sourcePath, "utf8"));
  const validatedPayload = validatePayload(payload, locale);
  const completedEntries = validatedPayload.entries.filter((entry) => entry.translation);
  if (completedEntries.length === 0) {
    throw new Error(`${locale} must contain at least one completed translation.`);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    locale: validatedPayload.locale,
    version: validatedPayload.version,
    count: completedEntries.length,
    sourceCount: validatedPayload.entries.length,
    entries: completedEntries
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${output.count} completed ${locale} item translations from ${output.sourceCount} source entries to ${outputPath}`
  );
}

for (const locale of supportedLocales) {
  await buildLocale(locale);
}
