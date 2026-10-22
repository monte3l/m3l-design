// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * Geometry of the MONTE3L logo, as SVG strings. Nothing here reads a file or a
 * token: `bin/build-brand.mjs` passes the colours in, so this module is pure.
 *
 * The symbol is two tiles, an E (ink) and a 3 (wine), the 3 tipped, parted by
 * a gap. The gap and both letters are cut out of the shapes with masks, so a
 * symbol has no background colour and works on any ground. A fill is an
 * attribute string (`fill="#692746"` or `class="e"`) so the favicon can switch
 * colour with `prefers-color-scheme`, which a presentation attribute cannot.
 */
import { GLYPHS } from "./brand-glyphs.mjs";

/** Letters of the wordmark are tracked +0.09em, the brand book's rule for weight 700. */
const TRACKING = 90;
const CAP_HEIGHT = 668;

/** Two cuts of the symbol on a 1000-unit canvas. `small` is for 64 px and below. */
const VARIANTS = {
  large: { size: 470, eX: 325, wX: 675, rot: -7, k: 0.6, gap: 30, radius: 96 },
  small: { size: 500, eX: 285, wX: 715, rot: -6, k: 0.72, gap: 44, radius: 100 },
};

/** Bounding box of the large symbol: the tight crop for logos and lockups. */
export const SYMBOL_BOX = { x: 90, y: 238, width: 847, height: 524 };

/** Centres a glyph on the origin of its tile, optically by its own bounds. */
function placeGlyph(char, k) {
  const [x0, y0, x1, y1] = GLYPHS[char].bounds;
  return `translate(${-((x0 + x1) / 2) * k} ${((y0 + y1) / 2) * k}) scale(${k} ${-k})`;
}

const tileRect = (size, radius) =>
  `x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="${radius}"`;

/**
 * The defs and two groups of the symbol, without an `<svg>` wrapper, so a
 * lockup can place one inside a larger drawing. `scale` shrinks it about the
 * centre of the 1000 canvas; `id` keeps the mask ids unique within a page.
 */
export function symbolBody({ id, variant = "large", eAttr, wAttr, scale = 1 }) {
  const v = VARIANTS[variant];
  const place = (x, rot) =>
    `translate(${500 + (x - 500) * scale} 500) rotate(${rot}) scale(${scale})`;
  const everywhere = `x="-200" y="-200" width="1400" height="1400"`;
  return `<defs>
<mask id="${id}-e" maskUnits="userSpaceOnUse" ${everywhere}><rect ${everywhere} fill="#fff"/><g transform="${place(v.wX, v.rot)}"><rect ${tileRect(v.size + v.gap * 2, v.radius + v.gap)} fill="#000"/></g><g transform="${place(v.eX, 0)}"><path transform="${placeGlyph("E", v.k)}" d="${GLYPHS.E.d}" fill="#000"/></g></mask>
<mask id="${id}-w" maskUnits="userSpaceOnUse" ${everywhere}><rect ${everywhere} fill="#fff"/><g transform="${place(v.wX, v.rot)}"><path transform="${placeGlyph("3", v.k)}" d="${GLYPHS["3"].d}" fill="#000"/></g></mask>
</defs>
<g mask="url(#${id}-e)"><g transform="${place(v.eX, 0)}"><rect ${tileRect(v.size, v.radius)} ${eAttr}/></g></g>
<g mask="url(#${id}-w)"><g transform="${place(v.wX, v.rot)}"><rect ${tileRect(v.size, v.radius)} ${wAttr}/></g></g>`;
}

/** A complete symbol file. `box` defaults to the square 1000 canvas. */
export function symbolSvg({ id = "m3l", title = "MONTE3L", style = "", box = "0 0 1000 1000", ...rest }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">${title}</title>${style}
${symbolBody({ id, ...rest })}
</svg>
`;
}

/** The letters of MONTE3L as paths on a 668-unit baseline box, plus the box width. */
export function wordmarkBody({ fill, accent }) {
  let x = 0;
  let body = "";
  for (const char of "MONTE3L") {
    const colour = char === "3" ? accent : fill;
    body += `<path ${colour} transform="translate(${x} ${CAP_HEIGHT}) scale(1 -1)" d="${GLYPHS[char].d}"/>`;
    x += GLYPHS[char].adv + TRACKING;
  }
  return { width: x - TRACKING, body };
}

export function wordmarkSvg({ id = "m3l", title = "MONTE3L", fill, accent }) {
  const { width, body } = wordmarkBody({ fill, accent });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${CAP_HEIGHT}" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">${title}</title>
${body}
</svg>
`;
}

/** Symbol, a gap of 0.27 symbol heights, then the wordmark at 0.36 of the symbol's height. */
export function lockupSvg({ id = "m3l", title = "MONTE3L", eAttr, wAttr, fill, accent }) {
  const { x, y, width, height } = SYMBOL_BOX;
  const k = (height * 0.36) / CAP_HEIGHT;
  const gap = height * 0.27;
  const word = wordmarkBody({ fill, accent });
  const total = Math.round(width + gap + word.width * k);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">${title}</title>
<g transform="translate(${-x} ${-y})">${symbolBody({ id, eAttr, wAttr })}</g>
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
  const word = wordmarkBody({ fill: `fill="${c.ink}"`, accent: `fill="${c.wine}"` });
  const wk = 28 / CAP_HEIGHT;
  const text = lines
    .map((line, i) => `<text x="80" y="${height - 110 + i * 46}" font-size="32" fill="${c.secondary}">${escapeXml(line)}</text>`)
    .join("\n");
  const nameY = height - 190;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">${escapeXml(name)}: ${escapeXml(tagline)}</title>
<rect width="${width}" height="${height}" fill="${c.ground}"/>
<g transform="translate(${width - 532} -85) scale(0.55)">${symbolBody({ id: `${id}-s`, eAttr: `fill="${c.ink}"`, wAttr: `fill="${c.wine}"` })}</g>
<g transform="translate(80 80) scale(${wk})">${word.body}</g>
<g font-family="${fontFamily}">
<text x="80" y="${nameY}" font-size="${size}" font-weight="700" letter-spacing="${(size * 0.09).toFixed(1)}" fill="${c.ink}">${escapeXml(name)}</text>
${text}
</g>
</svg>
`;
}
