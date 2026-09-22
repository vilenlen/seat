export type ThemeRecord = Record<string, unknown>;

export const isObjectRecord = (value: unknown): value is ThemeRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function toKebabCase(value: string): string {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

const HSL_CHANNEL_TRIPLET_PATTERN =
  /^\s*-?\d*\.?\d+(?:deg|rad|turn)?\s+-?\d*\.?\d+%\s+-?\d*\.?\d+%\s*$/i;

type RgbChannels = {
  r: number;
  g: number;
  b: number;
};

export function isHslChannelTriplet(value: string): boolean {
  return HSL_CHANNEL_TRIPLET_PATTERN.test(value);
}

function formatDecimal(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  const rounded = Math.round(normalized * 1000) / 1000;
  return Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseFiniteNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatHueToken(value: string): string | null {
  const match = value.trim().match(/^(-?\d*\.?\d+)(deg|rad|turn)?$/i);
  if (!match) return null;
  const numeric = parseFiniteNumber(match[1]);
  if (numeric == null) return null;
  return `${formatDecimal(numeric)}${match[2] ?? ""}`;
}

function formatPercentageToken(value: string): string | null {
  const match = value.trim().match(/^(-?\d*\.?\d+)%$/);
  if (!match) return null;
  const numeric = parseFiniteNumber(match[1]);
  if (numeric == null) return null;
  return `${formatDecimal(numeric)}%`;
}

function normalizeHslChannelTriplet(value: string): string | null {
  if (!isHslChannelTriplet(value)) return null;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 3) return null;
  const hue = formatHueToken(parts[0]);
  const saturation = formatPercentageToken(parts[1]);
  const lightness = formatPercentageToken(parts[2]);
  if (!hue || !saturation || !lightness) return null;
  return `${hue} ${saturation} ${lightness}`;
}

function parseHslFunctionToTriplet(value: string): string | null {
  const match = value.trim().match(/^hsla?\((.*)\)$/i);
  if (!match) return null;

  const withoutAlpha = match[1].split("/")[0]?.trim() ?? "";
  const parts = withoutAlpha.includes(",")
    ? withoutAlpha
        .split(",")
        .slice(0, 3)
        .map((part) => part.trim())
    : withoutAlpha.split(/\s+/).filter(Boolean);

  if (parts.length < 3) return null;
  const hue = formatHueToken(parts[0]);
  const saturation = formatPercentageToken(parts[1]);
  const lightness = formatPercentageToken(parts[2]);
  if (!hue || !saturation || !lightness) return null;
  return `${hue} ${saturation} ${lightness}`;
}

function parseHexColorToRgb(value: string): RgbChannels | null {
  const match = value
    .trim()
    .match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!match) return null;

  const hex = match[1];
  const rgbHex =
    hex.length === 3 || hex.length === 4
      ? hex
          .slice(0, 3)
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex.slice(0, 6);

  return {
    r: parseInt(rgbHex.slice(0, 2), 16),
    g: parseInt(rgbHex.slice(2, 4), 16),
    b: parseInt(rgbHex.slice(4, 6), 16),
  };
}

function parseRgbComponent(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    const percentage = parseFiniteNumber(trimmed.slice(0, -1));
    if (percentage == null) return null;
    return clamp((percentage / 100) * 255, 0, 255);
  }
  const numeric = parseFiniteNumber(trimmed);
  if (numeric == null) return null;
  return clamp(numeric, 0, 255);
}

function parseRgbFunctionToRgb(value: string): RgbChannels | null {
  const match = value.trim().match(/^rgba?\((.*)\)$/i);
  if (!match) return null;

  const withoutAlpha = match[1].split("/")[0]?.trim() ?? "";
  const parts = withoutAlpha.includes(",")
    ? withoutAlpha
        .split(",")
        .slice(0, 3)
        .map((part) => part.trim())
    : withoutAlpha.split(/\s+/).filter(Boolean);

  if (parts.length < 3) return null;
  const [r, g, b] = parts.slice(0, 3).map(parseRgbComponent);
  if (r == null || g == null || b == null) return null;
  return { r, g, b };
}

function parseBareRgbChannelTripletToRgb(value: string): RgbChannels | null {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 3) return null;

  const channels = parts.map((part) => {
    if (part.endsWith("%")) return null;
    const numeric = parseFiniteNumber(part);
    if (numeric == null || numeric < 0 || numeric > 255) return null;
    return numeric;
  });

  const [r, g, b] = channels;
  if (r == null || g == null || b == null) return null;
  return { r, g, b };
}

function rgbToHslChannelTriplet({ r, g, b }: RgbChannels): string {
  const red = clamp(r, 0, 255) / 255;
  const green = clamp(g, 0, 255) / 255;
  const blue = clamp(b, 0, 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return `0 0% ${formatDecimal(lightness * 100)}%`;
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return `${formatDecimal(hue * 60)} ${formatDecimal(
    saturation * 100,
  )}% ${formatDecimal(lightness * 100)}%`;
}

export function normalizeColorToHslChannelTriplet(
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hslTriplet = normalizeHslChannelTriplet(trimmed);
  if (hslTriplet) return hslTriplet;

  const hslFunction = parseHslFunctionToTriplet(trimmed);
  if (hslFunction) return hslFunction;

  const hexRgb = parseHexColorToRgb(trimmed);
  if (hexRgb) return rgbToHslChannelTriplet(hexRgb);

  const functionRgb = parseRgbFunctionToRgb(trimmed);
  if (functionRgb) return rgbToHslChannelTriplet(functionRgb);

  const bareRgb = parseBareRgbChannelTripletToRgb(trimmed);
  if (bareRgb) return rgbToHslChannelTriplet(bareRgb);

  return null;
}

function formatCssValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}px`;
  }
  return null;
}

function formatUnitlessCssValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function formatFontFamily(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const stack = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : null))
    .filter((entry): entry is string => Boolean(entry));
  return stack.length > 0 ? stack.join(", ") : null;
}

function flattenStringThemeValues(
  values: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value == null) continue;
    const name = prefix ? `${prefix}-${key}` : key;
    if (typeof value === "string") {
      vars[name] = value;
    } else if (isObjectRecord(value)) {
      Object.assign(vars, flattenStringThemeValues(value, name));
    }
  }
  return vars;
}

function flattenCssThemeValues(
  values: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value == null) continue;
    const name = prefix ? `${prefix}-${key}` : key;
    const cssValue = formatCssValue(value);
    if (cssValue) {
      vars[name] = cssValue;
    } else if (isObjectRecord(value)) {
      Object.assign(vars, flattenCssThemeValues(value, name));
    }
  }
  return vars;
}

function flattenColorsToVars(
  colors: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors)) {
    if (value == null) continue;
    const name = prefix ? `${prefix}-${key}` : key;
    if (typeof value === "string") {
      vars[name] = normalizeColorToHslChannelTriplet(value) ?? value.trim();
    } else if (isObjectRecord(value)) {
      Object.assign(vars, flattenColorsToVars(value, name));
    }
  }
  return vars;
}

const TOKEN_NAME_ALIASES: Record<
  "color" | "radius" | "shadow" | "border",
  Record<string, readonly string[]>
> = {
  color: {
    background: ["bg"],
  },
  radius: {},
  shadow: {},
  border: {},
};

function expandTokenNamesWithAliases(
  category: "color" | "radius" | "shadow" | "border",
  kebabName: string,
): string[] {
  const names = new Set<string>([kebabName]);
  const [head, ...rest] = kebabName.split("-");
  const aliases = TOKEN_NAME_ALIASES[category][head] || [];
  for (const aliasHead of aliases) {
    names.add([aliasHead, ...rest].join("-"));
  }
  return Array.from(names);
}

function setTokenVar(
  target: Record<string, string>,
  category: "color" | "radius" | "shadow" | "border",
  resolvedName: string,
  value: string,
) {
  target[`--${category}-${resolvedName}`] = value;
  const camelName = toCamelCase(resolvedName);
  if (camelName !== resolvedName) {
    target[`--${category}-${camelName}`] = value;
  }
}

function assignTokenVar(
  target: Record<string, string>,
  category: "color" | "radius" | "shadow" | "border",
  name: string,
  value: string,
) {
  const kebabName = toKebabCase(name);
  for (const resolvedName of expandTokenNamesWithAliases(category, kebabName)) {
    if (resolvedName === "default") {
      setTokenVar(target, category, resolvedName, value);
      target[`--${category}-DEFAULT`] = value;
      continue;
    }
    if (resolvedName.endsWith("-default")) {
      const baseName = resolvedName.slice(0, -"-default".length);
      if (!baseName) continue;
      setTokenVar(target, category, baseName, value);
      target[`--${category}-${baseName}-DEFAULT`] = value;
      target[`--${category}-${baseName}-default`] = value;
      const camelBaseName = toCamelCase(baseName);
      if (camelBaseName !== baseName) {
        target[`--${category}-${camelBaseName}-DEFAULT`] = value;
        target[`--${category}-${camelBaseName}-default`] = value;
      }
      continue;
    }
    setTokenVar(target, category, resolvedName, value);
  }
}

function setTokenIfMissing(
  target: Record<string, string>,
  name: string,
  value: string | null,
): boolean {
  if (!value || target[name] !== undefined) {
    return false;
  }
  target[name] = value;
  return true;
}

function buildSpacingVarName(name: string): string {
  const kebabName = toKebabCase(name);
  return kebabName.startsWith("spacing-")
    ? `--${kebabName}`
    : `--spacing-${kebabName}`;
}

function collectTypeScaleVars(
  themeSource: ThemeRecord,
  vars: Record<string, string>,
): void {
  const typeScale = isObjectRecord(themeSource._type_scale_ratio)
    ? themeSource._type_scale_ratio
    : null;
  const roundedPx =
    typeScale && isObjectRecord(typeScale.rounded_px)
      ? typeScale.rounded_px
      : null;
  let emittedMetadataSizes = false;

  if (roundedPx) {
    for (const [role, value] of Object.entries(roundedPx)) {
      const cssValue = formatCssValue(value);
      if (
        setTokenIfMissing(vars, `--font-size-${toKebabCase(role)}`, cssValue)
      ) {
        emittedMetadataSizes = true;
      }
    }
  }

  const nativeFontSize = isObjectRecord(themeSource.fontSize)
    ? themeSource.fontSize
    : null;
  if (!nativeFontSize) {
    return;
  }

  if (!emittedMetadataSizes) {
    for (const [role, value] of Object.entries(nativeFontSize)) {
      const sizeValue = Array.isArray(value) ? value[0] : value;
      setTokenIfMissing(
        vars,
        `--font-size-${toKebabCase(role)}`,
        formatCssValue(sizeValue),
      );
    }
  }

  for (const [role, value] of Object.entries(nativeFontSize)) {
    const roleName = toKebabCase(role);
    const metadata =
      Array.isArray(value) && isObjectRecord(value[1])
        ? value[1]
        : isObjectRecord(value)
          ? value
          : null;
    if (!metadata) continue;
    setTokenIfMissing(
      vars,
      `--line-height-${roleName}`,
      formatUnitlessCssValue(metadata.lineHeight),
    );
    setTokenIfMissing(
      vars,
      `--letter-spacing-${roleName}`,
      formatUnitlessCssValue(metadata.letterSpacing),
    );
  }
}

function collectFontFamilyVars(
  themeSource: ThemeRecord,
  vars: Record<string, string>,
): void {
  const fontFamily = isObjectRecord(themeSource.fontFamily)
    ? themeSource.fontFamily
    : null;
  if (!fontFamily) {
    return;
  }

  for (const [role, value] of Object.entries(fontFamily)) {
    setTokenIfMissing(
      vars,
      `--font-${toKebabCase(role)}`,
      formatFontFamily(value),
    );
  }
}

function collectSpacingVars(
  themeSource: ThemeRecord,
  vars: Record<string, string>,
): void {
  const spacingRhythm = isObjectRecord(themeSource._spacing_rhythm)
    ? themeSource._spacing_rhythm
    : null;
  const spacingTokens =
    spacingRhythm && isObjectRecord(spacingRhythm.tokens)
      ? spacingRhythm.tokens
      : null;
  let emittedMetadataSpacing = false;

  if (spacingTokens) {
    for (const [name, value] of Object.entries(spacingTokens)) {
      if (
        setTokenIfMissing(
          vars,
          buildSpacingVarName(name),
          formatCssValue(value),
        )
      ) {
        emittedMetadataSpacing = true;
      }
    }
  }

  const nativeSpacing = isObjectRecord(themeSource.spacing)
    ? themeSource.spacing
    : null;
  if (!nativeSpacing || emittedMetadataSpacing) {
    return;
  }

  const spacingVars = flattenCssThemeValues(nativeSpacing);
  for (const [name, value] of Object.entries(spacingVars)) {
    setTokenIfMissing(vars, buildSpacingVarName(name), value);
  }
}

export function buildThemeTokenVariables(
  themeSource: ThemeRecord,
): Record<string, string> {
  const vars: Record<string, string> = {};

  const colors = isObjectRecord(themeSource.colors) ? themeSource.colors : null;
  if (colors) {
    const colorVars = flattenColorsToVars(colors);
    for (const [name, value] of Object.entries(colorVars)) {
      assignTokenVar(vars, "color", name, value);
    }
  }

  const radii = isObjectRecord(themeSource.radius)
    ? themeSource.radius
    : isObjectRecord(themeSource.borderRadius)
      ? themeSource.borderRadius
      : isObjectRecord(themeSource.radii)
        ? themeSource.radii
        : null;
  if (radii) {
    const radiusVars = flattenStringThemeValues(radii);
    for (const [name, value] of Object.entries(radiusVars)) {
      assignTokenVar(vars, "radius", name, value);
    }
  }

  const shadowSources = [themeSource.shadows, themeSource.boxShadow].filter(
    (source): source is Record<string, unknown> => isObjectRecord(source),
  );
  for (const shadowSource of shadowSources) {
    const shadowVars = flattenStringThemeValues(shadowSource);
    for (const [name, value] of Object.entries(shadowVars)) {
      assignTokenVar(vars, "shadow", name, value);
    }
  }

  const borders = isObjectRecord(themeSource.borders)
    ? themeSource.borders
    : null;
  if (borders) {
    const borderVars = flattenStringThemeValues(borders);
    for (const [name, value] of Object.entries(borderVars)) {
      assignTokenVar(vars, "border", name, value);
    }
  }

  collectTypeScaleVars(themeSource, vars);
  collectFontFamilyVars(themeSource, vars);
  collectSpacingVars(themeSource, vars);

  return vars;
}
