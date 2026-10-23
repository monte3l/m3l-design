// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: LicenseRef-MONTE3L-Brand

/**
 * Outlines of the seven letters of MONTE3L, taken from Atkinson Hyperlegible
 * Next Bold (SIL OFL-1.1, Copyright 2020-2024 The Atkinson Hyperlegible Next
 * Project Authors, https://github.com/googlefonts/atkinson-hyperlegible-next).
 * The OFL FAQ (1.1, 1.13) says artwork made from a font's outlines is not
 * itself subject to the OFL, so these are part of the MONTE3L logo and carry
 * the brand license, not MIT. Units are 1000 per em, y up, so a path is drawn
 * with a flip (`scale(1 -1)`). `bounds` is [xMin, yMin, xMax, yMax] and `adv`
 * is the advance width. Extracted once with fontTools; regenerate only if the
 * mark changes.
 */
export const GLYPHS = {
  M: {
    adv: 858,
    bounds: [60, 0, 798, 668],
    d: "M60 0V668H283L429 176L577 668H798V0H655V533L490 0H367L202 533V0Z",
  },
  O: {
    adv: 747,
    bounds: [33, -12, 714, 680],
    d: "M373 -12Q272 -12 195.5 31.5Q119 75 76.0 153.0Q33 231 33 334Q33 437 76.0 515.0Q119 593 195.5 636.5Q272 680 373 680Q474 680 551.0 636.5Q628 593 671.0 515.0Q714 437 714 334Q714 231 671.0 153.0Q628 75 551.0 31.5Q474 -12 373 -12ZM373 108Q424 108 466.5 134.0Q509 160 534.0 210.0Q559 260 559 334Q559 408 534.0 458.0Q509 508 466.5 534.0Q424 560 373 560Q323 560 280.5 534.0Q238 508 212.5 458.0Q187 408 187 334Q187 260 212.5 210.0Q238 160 280.5 134.0Q323 108 373 108Z",
  },
  N: {
    adv: 717,
    bounds: [60, 0, 657, 668],
    d: "M60 0V668H250L516 175V668H657V0H468L201 494V0Z",
  },
  T: {
    adv: 607,
    bounds: [14, 0, 593, 668],
    d: "M230 0V540H14V668H593V540H376V0Z",
  },
  E: {
    adv: 597,
    bounds: [60, 0, 563, 668],
    d: "M60 0V668H559V540H206V408H432V279H206V128H563V0Z",
  },
  "3": {
    adv: 600,
    bounds: [35, -12, 547, 680],
    d: "M288 -12Q200 -12 131.5 26.5Q63 65 35 142L163 187Q175 138 210.5 115.5Q246 93 291 93Q342 93 373.0 119.0Q404 145 404 192Q404 231 382.0 253.5Q360 276 322.5 285.5Q285 295 238 295H213V396H238Q309 396 351.5 421.5Q394 447 394 492Q394 533 361.0 554.0Q328 575 285 575Q243 575 211.0 554.5Q179 534 169 487L43 533Q61 583 98.5 615.5Q136 648 186.0 664.0Q236 680 292 680Q353 680 408.5 661.5Q464 643 499.0 604.0Q534 565 534 504Q534 447 503.0 408.5Q472 370 423 351Q486 330 516.5 287.0Q547 244 547 194Q547 125 510.5 79.0Q474 33 414.5 10.5Q355 -12 288 -12Z",
  },
  L: {
    adv: 552,
    bounds: [60, 0, 533, 668],
    d: "M60 0V668H206V128H533V0Z",
  },
};
