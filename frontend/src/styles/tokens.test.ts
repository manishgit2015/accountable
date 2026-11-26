// V-F11 (dark-mode plan 4.1): the tokens file is the only place a color is written (ENG-1), and every
// text color meets spec 3.9's contrast rule of at least 4.5:1 on the surfaces it's used on (NFR-7), in
// light mode and, once it has its own block, in dark mode.
// Files are read with Node's fs: Vitest turns CSS imports (even `?raw`) into empty strings, so a scan
// through Vite would check nothing. The app's own types have no Node APIs, hence the reference below.
/// <reference types="node" />
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// Vitest runs in frontend/ (scripts/run-tests.mjs). Under jsdom, import.meta.url isn't a file URL.
const SRC = join(process.cwd(), "src");
const TOKENS_FILE = join(SRC, "styles", "tokens.css");
if (!existsSync(TOKENS_FILE)) throw new Error(`Run this test from frontend/ (no ${TOKENS_FILE})`);
const TOKENS = readFileSync(TOKENS_FILE, "utf8");

type Tokens = Record<string, string>;

/** The `--name: value;` declarations inside the first block whose selector is exactly `selector`. */
function block(css: string, selector: string): Tokens | undefined {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return undefined;
  const body = css.slice(start, css.indexOf("}", start)).replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens: Tokens = {};
  for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    if (name !== undefined && value !== undefined) tokens[name] = value.trim();
  }
  return tokens;
}

const LIGHT = block(TOKENS, ":root") ?? {};
const DARK_OVERRIDES = block(TOKENS, ':root[data-theme="dark"]');

/** The tokens in dark mode: the light ones with the dark block on top. Throws if the dark block is missing. */
function darkTokens(): Tokens {
  if (DARK_OVERRIDES === undefined) throw new Error('No :root[data-theme="dark"] block in tokens.css');
  return { ...LIGHT, ...DARK_OVERRIDES };
}

/** A token's color, following `var(--other)` references, as `#rrggbb`. */
function hex(tokens: Tokens, name: string): string {
  const value = tokens[name];
  if (value === undefined) throw new Error(`No token ${name}`);
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value)?.[1];
  if (ref !== undefined) return hex(tokens, ref);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} is not a plain #rrggbb color: ${value}`);
  return value;
}

function channel(color: string, offset: number): number {
  const c = parseInt(color.slice(offset, offset + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  return 0.2126 * channel(color, 1) + 0.7152 * channel(color, 3) + 0.0722 * channel(color, 5);
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Text tokens used on panels and on the page (spec 3.9). */
const TEXT = ["--ink", "--sea-green-text", "--marigold-text", "--coral-text", "--cerulean-text", "--raspberry-text"];

/** [text, surface] pairs on fills, and other fixed pairs, that hold in both modes. */
const ON_FILLS: [string, string][] = [
  ["--midnight", "--sea-mist"],
  ["--midnight", "--sea-green"],
  ["--midnight", "--marigold"],
  ["--midnight", "--coral"],
  ["--on-fill", "--midnight"],
  ["--on-fill", "--cerulean-strong"],
  ["--on-fill", "--raspberry-strong"],
  ["--sea-mist", "--midnight"],
  ["--cerulean-text", "--cerulean-tint"],
];

function pairs(mode: "light" | "dark"): [string, string][] {
  const onSurfaces = TEXT.flatMap((text): [string, string][] => [
    [text, "--panel"],
    [text, "--raised"],
    [text, "--page"],
  ]);
  // Spec 3.9 says muted ink is for white only in light mode, but the app also puts it on the page there (under
  // the pipeline's column heads, the dashed "Add deal" buttons): checked, and pinned below as a known gap.
  const muted: [string, string][] =
    mode === "light"
      ? [
          ["--ink-muted", "--panel"],
          ["--ink-muted", "--raised"],
          ["--ink-muted", "--page"],
        ]
      : [
          ["--ink-muted", "--panel"],
          ["--ink-muted", "--raised"],
          ["--ink-muted", "--page"],
        ];
  return [...onSurfaces, ...muted, ...ON_FILLS];
}

function failures(tokens: Tokens, mode: "light" | "dark"): string[] {
  return pairs(mode)
    .map(([text, surface]) => ({ text, surface, ratio: contrast(hex(tokens, text), hex(tokens, surface)) }))
    .filter(({ ratio }) => ratio < 4.5)
    .map(({ text, surface, ratio }) => `${text} on ${surface}: ${ratio.toFixed(2)}:1`);
}

/**
 * Light mode's known shortfalls, which predate dark mode and stay because light mode mustn't change (R94).
 * Spec 17.1 tracks both, with where they show: Raspberry text on the page color (a hovered row's late date,
 * form error messages, the highlighted Delete menu item), and muted ink on the page color (the pipeline's
 * column heads, its dashed "Add deal" buttons and "Closed in" notes). Listing them exactly means a new
 * failure, or one of these being fixed, both show up here.
 */
const KNOWN_LIGHT_GAPS = ["--raspberry-text on --page: 4.47:1", "--ink-muted on --page: 4.15:1"];

describe("NFR-7 text contrast from the tokens", () => {
  it("NFR-7 light mode: every text color is at least 4.5:1 on its surfaces, apart from the known gaps", () => {
    expect(failures(LIGHT, "light")).toEqual(KNOWN_LIGHT_GAPS);
  });

  // The dark checks never skip: if the dark block can't be found (its selector edited), they fail.
  it("R92 the dark block is found in tokens.css, and redefines the surfaces and text", () => {
    expect(DARK_OVERRIDES, ':root[data-theme="dark"] block').toBeDefined();
    expect(Object.keys(DARK_OVERRIDES ?? {})).toEqual(
      expect.arrayContaining(["--page", "--panel", "--raised", "--ink"]),
    );
  });

  it("NFR-7 dark mode: every text color is at least 4.5:1 on its surfaces", () => {
    expect(failures(darkTokens(), "dark")).toEqual([]);
  });

  it("NFR-7 dark mode: field outlines and dashed lines are at least 3:1 on every surface they sit on", () => {
    const dark = darkTokens();
    // Fields sit on panels and, inside side panels and dialogs, on the raised surface; dashed lines on the page.
    for (const surface of ["--panel", "--raised", "--page"]) {
      expect(contrast(hex(dark, "--line"), hex(dark, surface)), surface).toBeGreaterThanOrEqual(3);
    }
  });

  it("ENG-1 dark mode only redefines tokens light mode has", () => {
    const unknown = Object.keys(DARK_OVERRIDES ?? {}).filter((name) => !(name in LIGHT));
    expect(DARK_OVERRIDES).toBeDefined();
    expect(unknown).toEqual([]);
  });

  it("the contrast arithmetic matches spec 3.9's published figures", () => {
    expect(contrast("#073b4c", "#ffffff")).toBeCloseTo(12.1, 1);
    expect(contrast("#5b7a85", "#ffffff")).toBeCloseTo(4.6, 1);
  });
});

/** Every .css, .ts and .tsx file under src, except tests and the tokens file, by path. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    const isSource = /\.(css|tsx?)$/.test(name) && !/\.test\.tsx?$/.test(name);
    return isSource && path !== TOKENS_FILE ? [path] : [];
  });
}

const SOURCES: Record<string, string> = Object.fromEntries(
  sourceFiles(SRC).map((path) => [relative(SRC, path).replaceAll("\\", "/"), readFileSync(path, "utf8")]),
);

/** Literal colors: hex, rgb(a) and hsl(a) anywhere, and named colors as a CSS value or a color prop. */
const NAMED = "white|black|red|green|blue|gray|grey|yellow|orange|purple|pink";
const LITERAL = [
  /#[0-9a-f]{3,8}\b(?![-\w])/gi,
  /\b(?:rgba?|hsla?)\(/gi,
  new RegExp(
    `(?:^|[\\s{;])(?:color|background|background-color|fill|stroke|border-color|outline-color)\\s*:\\s*["']?(?:${NAMED})\\b`,
    "gim",
  ),
  new RegExp(`\\b(?:fill|stroke|color|background)=["'](?:${NAMED})["']`, "gi"),
];

function literalColors(path: string, source: string): string[] {
  // Comments may name colors ("white text"), so they're left out.
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  return LITERAL.flatMap((pattern) => [...text.matchAll(pattern)].map((m) => `${path}: ${m[0].trim()}`));
}

function hasLiteral(sample: string): boolean {
  return LITERAL.some((pattern) => new RegExp(pattern.source, pattern.flags).test(sample));
}

describe("ENG-1 colors come only from tokens", () => {
  it("ENG-1 the scan covers the styles, components, pages and charts", () => {
    const paths = Object.keys(SOURCES);
    expect(paths).toContain("styles/global.css");
    expect(paths).toContain("components/TopBar.tsx");
    expect(paths).toContain("pages/dashboard/RevenueChart.tsx");
    expect(paths).not.toContain("styles/tokens.css");
    // Not empty: the scan reads real contents (Vitest's CSS imports would be blank).
    expect(SOURCES["styles/global.css"]?.length).toBeGreaterThan(10_000);
    expect(TOKENS).toContain("--midnight");
  });

  it("ENG-1 no color is written outside styles/tokens.css", () => {
    expect(Object.entries(SOURCES).flatMap(([path, source]) => literalColors(path, source))).toEqual([]);
  });

  it("ENG-1 the literal-color check catches each kind of color, and not a url(#id)", () => {
    for (const sample of [
      ".a { color: #fff; }",
      "x = rgba(0, 0, 0, 0.5)",
      ".b { background: white; }",
      '<rect fill="black" />',
    ]) {
      expect(hasLiteral(sample), sample).toBe(true);
    }
    expect(hasLiteral('fill="url(#revenue-fill)"')).toBe(false);
  });
});
