import assert from "node:assert/strict";
import test from "node:test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { mapThemeColorsToHslTokens } from "../tailwind.config.ts";
import {
  buildThemeTokenVariables,
  isHslChannelTriplet,
  normalizeColorToHslChannelTriplet,
  type ThemeRecord,
} from "./theme-token-vars.ts";

const pickVars = (vars: Record<string, string>, prefix: string) =>
  Object.fromEntries(
    Object.entries(vars).filter(([name]) => name.startsWith(prefix)),
  );

test("buildThemeTokenVariables emits typography and spacing metadata without regressing existing vars", () => {
  const theme: ThemeRecord = {
    colors: {
      background: {
        DEFAULT: "220 20% 98%",
        shell: "220 25% 95%",
      },
      primary: "210 90% 50%",
    },
    radii: {
      card: "18px",
    },
    shadows: {
      card: "0 22px 70px rgba(15, 23, 42, 0.18)",
    },
    fontFamily: {
      display: ['"Editorial New"', "Georgia", "serif"],
      body: "Inter, system-ui, sans-serif",
    },
    fontSize: {
      display: ["72px", { lineHeight: "0.92", letterSpacing: "-0.045em" }],
      h1: ["56px", { lineHeight: "1", letterSpacing: "-0.035em" }],
      h2: ["40px", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
      body: ["16px", { lineHeight: "1.65", letterSpacing: "0em" }],
      "body-lg": ["18px", { lineHeight: "1.55", letterSpacing: "-0.005em" }],
      caption: ["12px", { lineHeight: "1.35", letterSpacing: "0.04em" }],
    },
    _type_scale_ratio: {
      rounded_px: {
        display: 84,
        h1: 64,
        h2: 48,
        body: 16,
        "body-lg": 18,
        caption: 12,
      },
    },
    _spacing_rhythm: {
      tokens: {
        "spacing-micro": 4,
        "spacing-section": 112,
        "spacing-stack-lg": 40,
      },
    },
  };

  const vars = buildThemeTokenVariables(theme);

  assert.equal(vars["--font-size-display"], "84px");
  assert.equal(vars["--font-size-h1"], "64px");
  assert.equal(vars["--font-size-h2"], "48px");
  assert.equal(vars["--font-size-body"], "16px");
  assert.equal(vars["--font-size-body-lg"], "18px");
  assert.equal(vars["--font-size-caption"], "12px");

  assert.equal(vars["--font-display"], '"Editorial New", Georgia, serif');
  assert.equal(vars["--font-body"], "Inter, system-ui, sans-serif");
  assert.equal(vars["--line-height-display"], "0.92");
  assert.equal(vars["--letter-spacing-h1"], "-0.035em");
  assert.equal(vars["--line-height-body-lg"], "1.55");
  assert.equal(vars["--letter-spacing-caption"], "0.04em");

  assert.equal(vars["--spacing-micro"], "4px");
  assert.equal(vars["--spacing-section"], "112px");
  assert.equal(vars["--spacing-stack-lg"], "40px");

  assert.equal(vars["--color-background"], "220 20% 98%");
  assert.equal(vars["--color-background-shell"], "220 25% 95%");
  assert.equal(vars["--color-primary"], "210 90% 50%");
  assert.equal(vars["--radius-card"], "18px");
  assert.equal(vars["--shadow-card"], "0 22px 70px rgba(15, 23, 42, 0.18)");
  assert.equal(Object.keys(vars).length, new Set(Object.keys(vars)).size);
});

test("buildThemeTokenVariables falls back to native fontSize and spacing shapes", () => {
  const vars = buildThemeTokenVariables({
    fontSize: {
      h1: ["48px", { lineHeight: "1.08", letterSpacing: "-0.02em" }],
      body: "16px",
    },
    spacing: {
      section: "96px",
      stack: {
        lg: 32,
      },
    },
  });

  assert.equal(vars["--font-size-h1"], "48px");
  assert.equal(vars["--font-size-body"], "16px");
  assert.equal(vars["--line-height-h1"], "1.08");
  assert.equal(vars["--letter-spacing-h1"], "-0.02em");
  assert.equal(vars["--spacing-section"], "96px");
  assert.equal(vars["--spacing-stack-lg"], "32px");
});

test("buildThemeTokenVariables skips typography and spacing when no sources exist", () => {
  const vars = buildThemeTokenVariables({
    colors: { primary: "210 90% 50%" },
    radius: { card: "12px" },
    shadows: { card: "0 10px 30px rgba(0,0,0,0.12)" },
  });

  assert.deepEqual(pickVars(vars, "--font-"), {});
  assert.deepEqual(pickVars(vars, "--font-size-"), {});
  assert.deepEqual(pickVars(vars, "--line-height-"), {});
  assert.deepEqual(pickVars(vars, "--letter-spacing-"), {});
  assert.deepEqual(pickVars(vars, "--spacing-"), {});
  assert.equal(vars["--color-primary"], "210 90% 50%");
  assert.equal(vars["--radius-card"], "12px");
  assert.equal(vars["--shadow-card"], "0 10px 30px rgba(0,0,0,0.12)");
});

test("buildThemeTokenVariables emits color variables as HSL channel triplets", () => {
  const vars = buildThemeTokenVariables({
    colors: {
      background: {
        DEFAULT: "#0E0E0E",
      },
      surface: {
        base: "#0E0E0E",
        raised: "#1A1A1A",
      },
      text: {
        primary: "#F5F2EC",
      },
      accent: "hsl(40 31% 94% / 0.8)",
      muted: "rgb(128 128 128 / 0.5)",
      legacy: "220 20% 98%",
      bareRgb: "74 93 78",
    },
  });

  const colorVars = pickVars(vars, "--color-");
  assert.equal(colorVars["--color-background"], "0 0% 5.49%");
  assert.equal(colorVars["--color-bg"], "0 0% 5.49%");
  assert.equal(colorVars["--color-surface-base"], "0 0% 5.49%");
  assert.equal(colorVars["--color-accent"], "40 31% 94%");
  assert.equal(colorVars["--color-legacy"], "220 20% 98%");
  assert.equal(
    colorVars["--color-bare-rgb"],
    normalizeColorToHslChannelTriplet("rgb(74 93 78)"),
  );

  for (const [name, value] of Object.entries(colorVars)) {
    assert.ok(isHslChannelTriplet(value), `${name} must be an HSL triplet`);
    assert.ok(!value.startsWith("#"), `${name} must not be hex`);
  }
  assert.doesNotMatch(JSON.stringify(colorVars), /hsl\(#/);
});

test("normalizeColorToHslChannelTriplet supports generated theme color formats", () => {
  assert.equal(normalizeColorToHslChannelTriplet("#0E0E0E"), "0 0% 5.49%");
  assert.equal(
    normalizeColorToHslChannelTriplet("hsl(140 12% 95%)"),
    "140 12% 95%",
  );
  assert.equal(
    normalizeColorToHslChannelTriplet("rgb(14 14 14 / 0.7)"),
    "0 0% 5.49%",
  );
  assert.equal(
    normalizeColorToHslChannelTriplet("74 93 78"),
    normalizeColorToHslChannelTriplet("rgb(74 93 78)"),
  );
  assert.equal(normalizeColorToHslChannelTriplet("oklch(50% 0.1 20)"), null);
});

test("mapThemeColorsToHslTokens routes alpha-safe color utilities through CSS vars", () => {
  const mapped = mapThemeColorsToHslTokens({
    surface: {
      base: "#0E0E0E",
    },
    text: {
      primary: "hsl(40 31% 94%)",
    },
    background: {
      DEFAULT: "220 20% 98%",
    },
    bareRgb: "74 93 78",
    unsupported: "oklch(50% 0.1 20)",
  });

  assert.equal(
    (mapped.surface as Record<string, string>).base,
    "hsl(var(--color-surface-base) / <alpha-value>)",
  );
  assert.equal(
    (mapped.text as Record<string, string>).primary,
    "hsl(var(--color-text-primary) / <alpha-value>)",
  );
  assert.equal(
    (mapped.background as Record<string, string>).DEFAULT,
    "hsl(var(--color-background) / <alpha-value>)",
  );
  assert.equal(mapped.bareRgb, "hsl(var(--color-bare-rgb) / <alpha-value>)");
  assert.equal(mapped.unsupported, "oklch(50% 0.1 20)");
  assert.doesNotMatch(JSON.stringify(mapped), /hsl\(#/);
});

test("Tailwind opacity modifiers compile against tokenized HSL color vars", async () => {
  const colors = mapThemeColorsToHslTokens({
    surface: {
      base: "#0E0E0E",
    },
    text: {
      primary: "hsl(40 31% 94%)",
    },
  });

  const result = await postcss([
    tailwindcss({
      content: [
        {
          raw: '<main class="bg-surface-base/50 text-text-primary/75"></main>',
        },
      ],
      corePlugins: {
        preflight: false,
      },
      theme: {
        extend: {
          colors,
        },
      },
    }),
  ]).process("@tailwind utilities;", { from: undefined });

  assert.match(
    result.css,
    /background-color: hsl\(var\(--color-surface-base\) \/ 0\.5\)/,
  );
  assert.match(
    result.css,
    /color: hsl\(var\(--color-text-primary\) \/ 0\.75\)/,
  );
  assert.doesNotMatch(result.css, /hsl\(#/);
});
