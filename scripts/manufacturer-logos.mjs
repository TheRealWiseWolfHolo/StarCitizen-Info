const PRIMARY_PUBLISHED_BASE_URL = "https://starcitizen-info.pages.dev";
const FALLBACK_PUBLISHED_BASE_URL = "https://therealwisewolfholo.github.io/StarCitizen-Info";
const MANUFACTURER_MEDIA_DIRECTORY = "media/manufacturers";

const MANUFACTURER_LOGO_SPECS = [
  {
    slug: "aegis-dynamics",
    name: "Aegis Dynamics",
    aliases: ["Aegis Dynamics"],
    defaultVariant: "black",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      white: "white.png"
    }
  },
  {
    slug: "anvil-aerospace",
    name: "Anvil Aerospace",
    aliases: ["Anvil Aerospace"],
    defaultVariant: "color",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      color: "color.png",
      white: "white.png"
    }
  },
  {
    slug: "aopoa",
    name: "Aopoa",
    aliases: ["Aopoa"],
    defaultVariant: "dark",
    onLightBackgroundVariant: "dark",
    onDarkBackgroundVariant: "light",
    variants: {
      dark: "dark.png",
      light: "light.png"
    }
  },
  {
    slug: "argo-astronautics",
    name: "Argo Astronautics",
    aliases: ["Argo Astronautics"],
    defaultVariant: "dark",
    onLightBackgroundVariant: "dark",
    onDarkBackgroundVariant: "light",
    variants: {
      dark: "dark.png",
      light: "light.png"
    }
  },
  {
    slug: "banu",
    name: "Banu",
    aliases: ["Banu", "Banu Souli"],
    defaultVariant: "black",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      white: "white.png"
    }
  },
  {
    slug: "consolidated-outland",
    name: "Consolidated Outland",
    aliases: ["Consolidated Outland"],
    defaultVariant: "color",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      color: "color.png",
      white: "white.png"
    }
  },
  {
    slug: "crusader-industries",
    name: "Crusader Industries",
    aliases: ["Crusader Industries"],
    defaultVariant: "black",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      white: "white.png"
    }
  },
  {
    slug: "drake-interplanetary",
    name: "Drake Interplanetary",
    aliases: ["Drake Interplanetary"],
    defaultVariant: "black",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      white: "white.png"
    }
  },
  {
    slug: "esperia",
    name: "Esperia",
    aliases: ["Esperia"],
    defaultVariant: "transparent",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      grey: "grey.png",
      transparent: "transparent.png",
      white: "white.png"
    }
  },
  {
    slug: "gatac-manufacture",
    name: "Gatac Manufacture",
    aliases: ["Gatac Manufacture"],
    defaultVariant: "dark",
    onLightBackgroundVariant: "dark",
    onDarkBackgroundVariant: "light",
    variants: {
      dark: "dark.png",
      light: "light.png"
    }
  },
  {
    slug: "greys-market",
    name: "Grey's Market",
    aliases: ["Grey's Market", "Greys Market"],
    defaultVariant: "black",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.svg",
      white: "white.png"
    }
  },
  {
    slug: "greycat-industrial",
    name: "Greycat Industrial",
    aliases: ["Greycat Industrial"],
    defaultVariant: "color",
    onLightBackgroundVariant: "color",
    onDarkBackgroundVariant: "black-white",
    variants: {
      "black-white": "black-white.svg",
      color: "color.svg"
    }
  },
  {
    slug: "kruger-intergalactic",
    name: "Kruger Intergalactic",
    aliases: ["Kruger Intergalactic"],
    defaultVariant: "black",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      white: "white.png"
    }
  },
  {
    slug: "misc",
    name: "MISC",
    aliases: ["MISC", "Musashi Industrial and Starflight Concern"],
    defaultVariant: "primary",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      primary: "primary.png",
      white: "white.png"
    }
  },
  {
    slug: "mirai",
    name: "Mirai",
    aliases: ["Mirai"],
    defaultVariant: "icon-mark",
    onLightBackgroundVariant: "primary-black",
    onDarkBackgroundVariant: "icon-mark",
    variants: {
      "icon-mark": "icon-mark.png",
      "primary-black": "primary-black.png"
    }
  },
  {
    slug: "origin-jumpworks",
    name: "Origin Jumpworks",
    aliases: ["Origin Jumpworks"],
    defaultVariant: "black",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      white: "white.png"
    }
  },
  {
    slug: "roberts-space-industries",
    name: "Roberts Space Industries",
    aliases: ["Roberts Space Industries", "RSI"],
    defaultVariant: "color",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      color: "color.png",
      white: "white.png"
    }
  },
  {
    slug: "tumbril",
    name: "Tumbril",
    aliases: ["Tumbril", "Tumbril Land Systems"],
    defaultVariant: "black",
    onLightBackgroundVariant: "black",
    onDarkBackgroundVariant: "white",
    variants: {
      black: "black.png",
      white: "white.png"
    }
  }
];

const specByAlias = new Map();

for (const spec of MANUFACTURER_LOGO_SPECS) {
  for (const alias of new Set([spec.name, ...(spec.aliases ?? [])])) {
    specByAlias.set(normalizeManufacturerName(alias), spec);
  }
}

export function resolveManufacturer(name) {
  const displayName = normalizeManufacturerDisplayName(name);
  if (!displayName) {
    return {
      slug: null,
      name: null,
      aliases: [],
      logos: null
    };
  }

  const spec = specByAlias.get(normalizeManufacturerName(displayName));
  if (!spec) {
    return {
      slug: slugifyManufacturerName(displayName),
      name: displayName,
      aliases: [displayName],
      logos: null
    };
  }

  return {
    slug: spec.slug,
    name: spec.name,
    aliases: Array.from(new Set([spec.name, ...(spec.aliases ?? [])])).sort((left, right) =>
      left.localeCompare(right)
    ),
    logos: buildLogoSet(spec)
  };
}

export function buildManufacturerDirectory(names) {
  const manufacturersBySlug = new Map();

  for (const rawName of names ?? []) {
    const displayName = normalizeManufacturerDisplayName(rawName);
    if (!displayName) {
      continue;
    }

    const resolved = resolveManufacturer(displayName);
    const slug = resolved.slug ?? slugifyManufacturerName(displayName);
    const existing = manufacturersBySlug.get(slug);

    if (existing) {
      existing.aliases = Array.from(
        new Set([...existing.aliases, displayName, ...resolved.aliases])
      ).sort((left, right) => left.localeCompare(right));
      continue;
    }

    manufacturersBySlug.set(slug, {
      slug,
      name: resolved.name ?? displayName,
      aliases: Array.from(new Set([displayName, ...resolved.aliases])).sort((left, right) =>
        left.localeCompare(right)
      ),
      logos: resolved.logos
    });
  }

  return Array.from(manufacturersBySlug.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

function buildLogoSet(spec) {
  const variants = Object.fromEntries(
    Object.entries(spec.variants).map(([variant, fileName]) => [
      variant,
      buildPublishedAssetReference(`${spec.slug}/${fileName}`)
    ])
  );

  return {
    default: spec.defaultVariant ? variants[spec.defaultVariant] ?? null : null,
    onLightBackground: spec.onLightBackgroundVariant
      ? variants[spec.onLightBackgroundVariant] ?? null
      : null,
    onDarkBackground: spec.onDarkBackgroundVariant
      ? variants[spec.onDarkBackgroundVariant] ?? null
      : null,
    variants
  };
}

function buildPublishedAssetReference(relativeFilePath) {
  const path = `${MANUFACTURER_MEDIA_DIRECTORY}/${relativeFilePath}`.replace(/\\/g, "/");

  return {
    path,
    primaryUrl: `${PRIMARY_PUBLISHED_BASE_URL}/${path}`,
    fallbackUrl: `${FALLBACK_PUBLISHED_BASE_URL}/${path}`
  };
}

function normalizeManufacturerDisplayName(value) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeManufacturerName(value) {
  return normalizeManufacturerDisplayName(value).toLowerCase();
}

function slugifyManufacturerName(value) {
  return normalizeManufacturerDisplayName(value)
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
