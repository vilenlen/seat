import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import {
  buildThemeTokenVariables,
  isObjectRecord,
  normalizeColorToHslChannelTriplet,
  toKebabCase,
  type ThemeRecord,
} from './tools/theme-token-vars.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mergeThemeRecords = (
  base: ThemeRecord,
  override: ThemeRecord
): ThemeRecord => {
  const result: ThemeRecord = { ...base };
  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = result[key];
    if (isObjectRecord(baseValue) && isObjectRecord(overrideValue)) {
      result[key] = mergeThemeRecords(baseValue, overrideValue);
      continue;
    }
    result[key] = overrideValue;
  }
  return result;
};

const extractCssVariables = (value: unknown): Record<string, string> => {
  if (!isObjectRecord(value)) return {};
  const vars: Record<string, string> = {};
  for (const [name, raw] of Object.entries(value)) {
    if (typeof raw === 'string' && name.startsWith('--')) {
      vars[name] = raw;
    }
  }
  return vars;
};

const normalizeTailwindThemeExtend = (value: ThemeRecord): ThemeRecord => {
  const {
    meta: _ignoredMeta,
    cssVariables: _ignoredCssVariables,
    ...rest
  } = value;
  const normalized: ThemeRecord = { ...rest };
  if (
    isObjectRecord(normalized.radius) &&
    !isObjectRecord(normalized.borderRadius)
  ) {
    normalized.borderRadius = normalized.radius;
  }
  if (
    isObjectRecord(normalized.shadows) &&
    !isObjectRecord(normalized.boxShadow)
  ) {
    normalized.boxShadow = normalized.shadows;
  }
  if (isObjectRecord(normalized.colors)) {
    normalized.colors = mapThemeColorsToHslTokens(normalized.colors);
  }
  return normalized;
};

function buildColorTokenName(pathParts: string[]): string {
  const normalizedParts = [...pathParts];
  const lastPart = normalizedParts[normalizedParts.length - 1];
  if (lastPart && lastPart.toLowerCase() === 'default') {
    normalizedParts.pop();
  }
  const tokenName = normalizedParts.join('-');
  return toKebabCase(tokenName || 'default');
}

export function mapThemeColorsToHslTokens(
  colors: Record<string, unknown>,
  pathParts: string[] = []
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(colors)) {
    const nextPath = [...pathParts, key];
    if (typeof value === 'string') {
      if (normalizeColorToHslChannelTriplet(value)) {
        const tokenName = buildColorTokenName(nextPath);
        mapped[key] = `hsl(var(--color-${tokenName}) / <alpha-value>)`;
      } else {
        mapped[key] = value;
      }
      continue;
    }
    if (isObjectRecord(value)) {
      mapped[key] = mapThemeColorsToHslTokens(value, nextPath);
      continue;
    }
    mapped[key] = value;
  }
  return mapped;
}

const themePath = path.resolve(__dirname, 'src/data/theme.json');
let themeExtend: ThemeRecord = {};
let defaultThemeSource: ThemeRecord = {};
let rootLegacyCssVariables: Record<string, string> = {};
let discoveredThemeNames: string[] = [];
let defaultThemeName: string | null = null;
const themesByName = new Map<string, ThemeRecord>();

try {
  if (fs.existsSync(themePath)) {
    const rawTheme = JSON.parse(
      fs.readFileSync(themePath, 'utf-8')
    ) as ThemeRecord;
    rootLegacyCssVariables = extractCssVariables(rawTheme.cssVariables);

    const meta = isObjectRecord(rawTheme.meta) ? rawTheme.meta : {};
    const configuredThemeNames = Array.isArray(meta.themes)
      ? meta.themes.filter(
          (entry): entry is string =>
            typeof entry === 'string' && entry.trim().length > 0
        )
      : [];

    const candidateNames = configuredThemeNames;

    discoveredThemeNames = Array.from(
      new Set(candidateNames.filter((name) => isObjectRecord(rawTheme[name])))
    );

    const sharedTheme = isObjectRecord(rawTheme.shared) ? rawTheme.shared : {};
    for (const themeName of discoveredThemeNames) {
      const specificTheme = rawTheme[themeName];
      if (!isObjectRecord(specificTheme)) continue;
      themesByName.set(
        themeName,
        mergeThemeRecords(sharedTheme, specificTheme)
      );
    }

    if (themesByName.size > 0) {
      const configuredDefault =
        typeof meta.defaultTheme === 'string' &&
        themesByName.has(meta.defaultTheme)
          ? meta.defaultTheme
          : null;
      defaultThemeName = configuredDefault ?? discoveredThemeNames[0] ?? null;
      if (defaultThemeName) {
        const defaultTheme = themesByName.get(defaultThemeName);
        if (defaultTheme) {
          defaultThemeSource = defaultTheme;
          themeExtend = normalizeTailwindThemeExtend(defaultTheme);
        }
      }
    } else {
      defaultThemeSource = rawTheme;
      themeExtend = normalizeTailwindThemeExtend(rawTheme);
    }
  }
} catch {
  // Use empty theme extension when parsing fails.
}

/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: [
      './src/**/*.{ts,tsx,js,jsx,html,json}',
      '../components/**/*.{ts,tsx,js,jsx}',
      '!../components/**/node_modules/**',
      '!../components/**/dist/**',
    ],
  },
  theme: {
    extend: themeExtend,
  },
  plugins: [
    function ({
      addBase,
    }: {
      addBase: (styles: Record<string, Record<string, string>>) => void;
    }) {
      if (themesByName.size > 0 && defaultThemeName) {
        const baseStyles: Record<string, Record<string, string>> = {};
        for (const [themeName, themeSource] of themesByName.entries()) {
          const themeLegacyVars = extractCssVariables(themeSource.cssVariables);
          const themeTokenVars = buildThemeTokenVariables(themeSource);
          const mergedVars = {
            ...rootLegacyCssVariables,
            ...themeLegacyVars,
            ...themeTokenVars,
          };
          if (Object.keys(mergedVars).length === 0) continue;

          const selector = `[data-theme="${themeName.replace(/"/g, '\\"')}"]`;
          baseStyles[selector] = mergedVars;
          if (themeName === defaultThemeName) {
            baseStyles[':root'] = mergedVars;
          }
        }
        if (Object.keys(baseStyles).length > 0) {
          addBase(baseStyles);
        }
        return;
      }

      const singleThemeSource = defaultThemeSource;
      const root = buildThemeTokenVariables(singleThemeSource);
      const themeLegacyVars = extractCssVariables(
        singleThemeSource.cssVariables
      );

      const mergedRoot = {
        ...rootLegacyCssVariables,
        ...themeLegacyVars,
        ...root,
      };
      if (Object.keys(mergedRoot).length > 0) {
        addBase({ ':root': mergedRoot });
      }
    },
  ],
};
