// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * Geometry of the MONTE3L logo, as SVG strings. Nothing here reads a file or a
 * token: `bin/build-brand.mjs` passes the colours in, so this module is pure.
 *
 * The symbol is two identical rounded peaks side by side, parted by a gap. It
 * has no letter in it, so nothing can read as one founder's initial: the two
 * peaks are the two people, and neither is placed or sized to lead. The left
 * peak takes `leftAttr` and the right `rightAttr`. A fill is an attribute
 * string (`fill="#692746"` or `class="e"`) so the favicon can switch colour
 * with `prefers-color-scheme`, which a presentation attribute cannot. Each
 * peak is a real path, with no stroke, so one fill is all a colour needs.
 */
import { GLYPHS } from "./brand-glyphs.mjs";

/** Letters of the wordmark are tracked +0.09em, the brand book's rule for weight 700. */
const TRACKING = 90;
const CAP_HEIGHT = 668;

/** A peak is an isosceles triangle with corners rounded to `RADIUS`, `WIDTH` wide and `HEIGHT` tall. */
const PEAK = { width: 440, height: 470, radius: 46, base: 730, centres: [270, 730] };

/** Bounding box of the symbol: the tight crop for logos and lockups. */
export const SYMBOL_BOX = { x: 50, y: 260, width: 900, height: 470 };

const round = (n) => Math.round(n * 100) / 100;

/**
 * A triangle with rounded corners, as the outline you get by growing the
 * triangle by `radius` and rounding its corners: edges moved out by `radius`
 * and a quarter-turn-sized arc around each original vertex.
 */
function peakPath(cx) {
  const { width, height, radius: r, base } = PEAK;
  const vertices = [
    [cx, base - height + r], // apex
    [cx + width / 2 - r, base - r], // base right
    [cx - width / 2 + r, base - r], // base left
  ];
  // Outward unit normal of the edge from vertices[i] to vertices[(i + 1) % 3]; the order is clockwise on screen.
  const normal = (i) => {
    const [x0, y0] = vertices[i];
    const [x1, y1] = vertices[(i + 1) % 3];
    const length = Math.hypot(x1 - x0, y1 - y0);
    return [(y1 - y0) / length, -(x1 - x0) / length];
  };
  const point = ([x, y], [nx, ny]) => `${round(x + nx * r)} ${round(y + ny * r)}`;
  let d = "";
  for (let i = 0; i < 3; i += 1) {
    const from = vertices[i];
    const to = vertices[(i + 1) % 3];
    const out = normal(i);
    const next = normal((i + 1) % 3);
    d += `${i === 0 ? "M" : "L"}${point(from, out)}L${point(to, out)}A${r} ${r} 0 0 1 ${point(to, next)}`;
  }
  return `${d}Z`;
}

/**
 * The two peaks, without an `<svg>` wrapper, so a lockup can place them inside
 * a larger drawing. `scale` shrinks them about the centre of the 1000 canvas.
 */
export function symbolBody({ leftAttr, rightAttr, scale = 1 }) {
  const place = `translate(${round(500 - 500 * scale)} ${round(500 - 495 * scale)}) scale(${scale})`;
  const [left, right] = PEAK.centres;
  return `<g transform="${place}"><path ${leftAttr} d="${peakPath(left)}"/><path ${rightAttr} d="${peakPath(right)}"/></g>`;
}

/**
 * A personal avatar: the peak repeated inward like the contour lines of a map,
 * on a square ground, centred for the circle GitHub crops it to. `bands` are the
 * four fills from the outer peak to the summit. The peaks are centred on the
 * canvas, a little above the middle of their bounding box so the triangle does
 * not look as if it is sinking.
 */
export function avatarSvg({ id, title, ground, bands }) {
  const scales = [1.45, 1.12, 0.79, 0.46];
  const d = peakPath(500);
  const peaks = scales
    .map((scale, i) => `<path fill="${bands[i]}" transform="translate(${round(500 - 500 * scale)} ${round(455 - 495 * scale)}) scale(${scale})" d="${d}"/>`)
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">${title}</title>
<rect width="1000" height="1000" fill="${ground}"/>
${peaks}
</svg>
`;
}

/** A complete symbol file. `box` defaults to the square 1000 canvas. */
export function symbolSvg({ id = "m3l", title = "MONTE3L", style = "", box = "0 0 1000 1000", ...rest }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">${title}</title>${style}
${symbolBody(rest)}
</svg>
`;
}

/** The letters of MONTE3L as paths on a 668-unit baseline box, plus the box width. */
export function wordmarkBody({ fill }) {
  let x = 0;
  let body = "";
  for (const char of "MONTE3L") {
    body += `<path ${fill} transform="translate(${x} ${CAP_HEIGHT}) scale(1 -1)" d="${GLYPHS[char].d}"/>`;
    x += GLYPHS[char].adv + TRACKING;
  }
  return { width: x - TRACKING, body };
}

export function wordmarkSvg({ id = "m3l", title = "MONTE3L", fill }) {
  const { width, body } = wordmarkBody({ fill });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${CAP_HEIGHT}" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">${title}</title>
${body}
</svg>
`;
}

/** Symbol, a gap of 0.27 symbol heights, then the wordmark at 0.36 of the symbol's height, in one colour. */
export function lockupSvg({ id = "m3l", title = "MONTE3L", leftAttr, rightAttr, fill }) {
  const { x, y, width, height } = SYMBOL_BOX;
  const k = (height * 0.36) / CAP_HEIGHT;
  const gap = height * 0.27;
  const word = wordmarkBody({ fill });
  const total = Math.round(width + gap + word.width * k);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">${title}</title>
<g transform="translate(${-x} ${-y})">${symbolBody({ leftAttr, rightAttr })}</g>
<g transform="translate(${width + gap} ${(height - CAP_HEIGHT * k) / 2}) scale(${k})">${word.body}</g>
</svg>
`;
}

const escapeXml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Breaks text into at most `lines` lines of about `limit` characters, adding an ellipsis if cut. */
function wrap(text, limit, lines) {
  const out = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean).map((w) => (w.length > limit ? `${w.slice(0, limit - 1)}…` : w))) {
    if (line && `${line} ${word}`.length > limit) {
      out.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = `${out[lines - 1].replace(/[\s.,;:]+$/, "").slice(0, limit - 1)}…`;
  }
  return out;
}

/**
 * A social card: the wordmark top left, the repository name and a one-line
 * description bottom left, the symbol bleeding off the top right. `c` holds
 * the light-theme colours (ground, ink, secondary, wine). The page that
 * renders it must load Atkinson Hyperlegible Next; the file names it first in
 * a fallback stack.
 */
export function cardSvg({ width, height, name, tagline, c, id = "card", fontFamily }) {
  const size = Math.min(80, Math.floor(1120 / (0.66 * name.length)));
  const lines = wrap(tagline, 64, 2);
  const word = wordmarkBody({ fill: `fill="${c.ink}"` });
  const wk = 28 / CAP_HEIGHT;
  const text = lines
    .map((line, i) => `<text x="80" y="${height - 110 + i * 46}" font-size="32" fill="${c.secondary}">${escapeXml(line)}</text>`)
    .join("\n");
  const nameY = height - 190;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">${escapeXml(name)}: ${escapeXml(tagline)}</title>
<rect width="${width}" height="${height}" fill="${c.ground}"/>
<g transform="translate(${width - 560} -82) scale(0.55)">${symbolBody({ leftAttr: `fill="${c.ink}"`, rightAttr: `fill="${c.wine}"` })}</g>
<g transform="translate(80 80) scale(${wk})">${word.body}</g>
<g font-family="${fontFamily}">
<text x="80" y="${nameY}" font-size="${size}" font-weight="700" letter-spacing="${(size * 0.09).toFixed(1)}" fill="${c.ink}">${escapeXml(name)}</text>
${text}
</g>
</svg>
`;
}
