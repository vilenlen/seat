import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildThemeTokenVariables,
  isObjectRecord,
  toKebabCase,
  type ThemeRecord,
} from './theme-token-vars.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const FIXED_THEME_PATH = 'src/data/theme.json';

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

const flattenTailwindKeys = (
  value: unknown,
  pathParts: string[] = []
): string[] => {
  if (typeof value === 'string') {
    return [pathParts.join('-')];
  }
  if (!isObjectRecord(value)) {
    return [];
  }

  const keys: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = toKebabCase(key);
    if (normalizedKey === 'default') {
      keys.push(...flattenTailwindKeys(child, pathParts));
      continue;
    }
    keys.push(...flattenTailwindKeys(child, [...pathParts, normalizedKey]));
  }
  return keys.filter((entry) => entry.length > 0);
};

const normalizeThemeValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeThemeValue(item))
      .filter((item) => item !== null);
  }
  if (!isObjectRecord(value)) {
    return null;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const normalizedChild = normalizeThemeValue(child);
    if (normalizedChild === null) continue;
    normalized[toKebabCase(key)] = normalizedChild;
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
};

const flattenTailwindKeyValueMap = (
  value: unknown,
  pathParts: string[] = []
): Record<string, string> => {
  if (typeof value === 'string') {
    const key = pathParts.join('-');
    return key ? { [key]: value } : {};
  }
  if (!isObjectRecord(value)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = toKebabCase(key);
    if (normalizedKey === 'default') {
      Object.assign(result, flattenTailwindKeyValueMap(child, pathParts));
      continue;
    }
    Object.assign(
      result,
      flattenTailwindKeyValueMap(child, [...pathParts, normalizedKey])
    );
  }
  return result;
};

const resolveThemeSource = (rawTheme: ThemeRecord) => {
  const meta = isObjectRecord(rawTheme.meta) ? rawTheme.meta : {};
  const configuredThemeNames = Array.isArray(meta.themes)
    ? meta.themes.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0
      )
    : [];

  const discoveredThemeNames = Array.from(
    new Set(
      configuredThemeNames.filter((name) => isObjectRecord(rawTheme[name]))
    )
  );

  const sharedTheme = isObjectRecord(rawTheme.shared) ? rawTheme.shared : {};
  const themesByName = new Map<string, ThemeRecord>();
  for (const themeName of discoveredThemeNames) {
    const specificTheme = rawTheme[themeName];
    if (!isObjectRecord(specificTheme)) continue;
    themesByName.set(themeName, mergeThemeRecords(sharedTheme, specificTheme));
  }

  if (themesByName.size > 0) {
    const configuredDefault =
      typeof meta.defaultTheme === 'string' &&
      themesByName.has(meta.defaultTheme)
        ? meta.defaultTheme
        : null;
    const defaultThemeName =
      configuredDefault ?? discoveredThemeNames[0] ?? null;
    if (defaultThemeName) {
      const selected = themesByName.get(defaultThemeName);
      if (selected) {
        return {
          source: selected,
          mode: 'multi-theme' as const,
          selectedTheme: defaultThemeName,
          availableThemes: discoveredThemeNames,
        };
      }
    }
  }

  return {
    source: rawTheme,
    mode: 'single-theme' as const,
    selectedTheme: null,
    availableThemes: [],
  };
};

const collectOptionalThemeSections = (themeSource: ThemeRecord) => {
  const sectionNames = [
    'fontFamily',
    'spacing',
    'fontSize',
    '_type_scale_ratio',
    '_spacing_rhythm',
    'screens',
  ] as const;
  const sections: Record<string, unknown> = {};
  for (const sectionName of sectionNames) {
    const rawSection = themeSource[sectionName];
    const normalizedSection = normalizeThemeValue(rawSection);
    if (normalizedSection === null) continue;
    sections[toKebabCase(sectionName)] = normalizedSection;
  }
  return sections;
};

const collectTailwindClassTemplates = (themeSource: ThemeRecord) => {
  const colors = isObjectRecord(themeSource.colors) ? themeSource.colors : {};
  const radius = isObjectRecord(themeSource.radius)
    ? themeSource.radius
    : isObjectRecord(themeSource.borderRadius)
      ? themeSource.borderRadius
      : {};
  const shadows = isObjectRecord(themeSource.shadows)
    ? themeSource.shadows
    : isObjectRecord(themeSource.boxShadow)
      ? themeSource.boxShadow
      : {};

  const colorKeys = Array.from(new Set(flattenTailwindKeys(colors))).sort(
    (a, b) => a.localeCompare(b)
  );
  const radiusKeys = Array.from(new Set(flattenTailwindKeys(radius))).sort(
    (a, b) => a.localeCompare(b)
  );
  const shadowKeys = Array.from(new Set(flattenTailwindKeys(shadows))).sort(
    (a, b) => a.localeCompare(b)
  );

  const colorPrefixes = [
    'bg',
    'text',
    'border',
    'ring',
    'fill',
    'stroke',
    'outline',
    'from',
    'via',
    'to',
  ];
  const colorKeyValueMap = flattenTailwindKeyValueMap(colors);
  const colorClasses: Record<string, string> = {};
  for (const [colorKey, colorValue] of Object.entries(colorKeyValueMap)) {
    for (const prefix of colorPrefixes) {
      colorClasses[`${prefix}-${colorKey}`] = colorValue;
    }
  }
  const roundedClasses = radiusKeys.map((key) =>
    key === 'default' ? 'rounded' : `rounded-${key}`
  );
  const shadowClasses = shadowKeys.map((key) =>
    key === 'default' ? 'shadow' : `shadow-${key}`
  );

  return {
    colorKeys,
    radiusKeys,
    shadowKeys,
    classes: {
      color: colorClasses,
      radius: roundedClasses,
      shadow: shadowClasses,
    },
  };
};

const ensureJsonFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`theme.json not found: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ThemeRecord;
  } catch (error) {
    throw new Error(
      `Failed to parse theme JSON: ${filePath}\n${String(error)}`
    );
  }
};

const main = () => {
  const absoluteThemePath = path.resolve(projectRoot, FIXED_THEME_PATH);
  if (!fs.existsSync(absoluteThemePath)) {
    process.stdout.write('');
    return;
  }
  const rawTheme = ensureJsonFile(absoluteThemePath);
  const resolved = resolveThemeSource(rawTheme);
  const classInfo = collectTailwindClassTemplates(resolved.source);
  const tokenVariables = Object.keys(
    buildThemeTokenVariables(resolved.source)
  ).sort((a, b) => a.localeCompare(b));
  const themeSections = collectOptionalThemeSections(resolved.source);

  const payload: Record<string, unknown> = {
    mode: resolved.mode,
    classTemplates: classInfo.classes,
    tokenVariables,
  };

  if (Object.keys(themeSections).length > 0) {
    payload.themeSections = themeSections;
  }

  if (resolved.mode === 'multi-theme') {
    if (resolved.selectedTheme) {
      payload.selectedTheme = resolved.selectedTheme;
    }
    if (resolved.availableThemes.length > 0) {
      payload.availableThemes = resolved.availableThemes;
    }
  }

  const description = [
    'Output format:',
    '- classTemplates.color is a map: tailwindColorClassName -> theme color value.',
    '- classTemplates.radius and classTemplates.shadow are arrays of class names.',
    '- tokenVariables lists available CSS variable names generated from theme tokens.',
    '- themeSections is optional and only includes keys present in theme.json: font-family, spacing, font-size, type-scale-ratio, spacing-rhythm, screens.',
  ].join('\n');

  process.stdout.write(`${description}\n${JSON.stringify(payload)}\n`);
};

main();
