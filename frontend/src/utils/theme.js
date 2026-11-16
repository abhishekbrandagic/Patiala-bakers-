// Website colours chosen in Settings. Each colour fills a small family of shades,
// written as CSS variables that index.css and the Tailwind colours read.
export const DEFAULT_THEME = {
  primary: "#6E1630",
  accent: "#B8893B",
  background: "#FBF6EE",
};
const KEY = "pb-theme-v1";
const HEX = /^#[0-9a-f]{6}$/i;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

function luminance([r, g, b]) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
// WCAG contrast ratio between two hex colours
export function contrast(a, b) {
  const [x, y] = [luminance(rgb(a)), luminance(rgb(b))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const clean = (theme) =>
  Object.fromEntries(
    Object.keys(DEFAULT_THEME).map((k) => [
      k,
      HEX.test(theme?.[k] || "") ? theme[k].toUpperCase() : DEFAULT_THEME[k],
    ]),
  );

// Only colours that differ from the original get new shades, so the default look stays exactly as designed
export function themeVars(theme) {
  const t = clean(theme);
  const vars = {};
  const set = (name, value) => {
    vars[`--c-${name}`] = value.join(" ");
  };
  if (t.primary !== DEFAULT_THEME.primary) {
    const p = rgb(t.primary);
    set("wine", p);
    set("wine-2", mix(p, BLACK, 0.18));
    set("wine-d", mix(p, BLACK, 0.46));
    set("wine-ink", mix(p, BLACK, 0.62));
  }
  if (t.accent !== DEFAULT_THEME.accent) {
    const a = rgb(t.accent);
    set("gold", a);
    set("gold-d", mix(a, BLACK, 0.27));
    set("gold-l", mix(a, WHITE, 0.58));
    set("gold-bg", mix(a, WHITE, 0.82));
  }
  if (t.background !== DEFAULT_THEME.background) {
    const g = rgb(t.background);
    set("cream", g);
    set("cream-2", mix(g, BLACK, 0.035));
    set("cream-3", mix(g, BLACK, 0.06));
    set("paper", mix(g, WHITE, 0.7));
    set("line", mix(g, BLACK, 0.09));
    set("line-2", mix(g, BLACK, 0.05));
  }
  return vars;
}

let applied = [];
export function applyTheme(theme) {
  const root = document.documentElement;
  for (const name of applied) root.style.removeProperty(name);
  const vars = themeVars(theme);
  for (const [name, value] of Object.entries(vars))
    root.style.setProperty(name, value);
  applied = Object.keys(vars);
  try {
    localStorage.setItem(KEY, JSON.stringify(clean(theme)));
  } catch {
    /* the default colours show until settings load */
  }
}

// Uses the last saved colours straight away, so the page doesn't flash the defaults
export function applySavedTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) applyTheme(saved);
  } catch {
    /* nothing saved yet */
  }
}
