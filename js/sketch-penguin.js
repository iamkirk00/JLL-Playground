// sketch-penguin.js — "living sketch" 2D puppets.
// Each penguin is layered pencil-style SVG traced from the original concept art:
// wobbly graphite strokes, hatch shading, cream paper — rigged for animation with
// a boiling-line effect (the wobble re-jitters like hand-drawn pencil animation).

export const PENGUIN_CONFIGS = {
  npc: {
    id: 'npc',
    body: '#cfc6ae',          // light flank tone; the dark lives in the hood/wings
    dark: '#857d6e',
    belly: '#f2ecda',
    beak: '#c9ba9b',
    foot: '#d9cfb4',
    line: '#55503f',
    defaultExpression: 'unimpressed',
    browWidth: 13,
    eye: { lx: 163, rx: 237, cy: 152, rW: 36, rH: 27 },
    jawTravel: 10,
    lidSkew: 6,
  },
  cap: {
    id: 'cap',
    body: '#8d8576',          // dark cap/back/wings
    dark: '#8d8576',
    belly: '#f6f0df',
    beak: '#d6c7a4',
    foot: '#d9cfb4',
    line: '#55503f',
    defaultExpression: 'bright',
    browWidth: 4.5,
    eye: { lx: 172, rx: 228, cy: 152, rW: 23, rH: 31 },
    jawTravel: 16,
    lidSkew: 0,
  },
};

// ---------- expression presets ----------
// brow angles in degrees; positive = inner end down (angry) for L, mirrored for R.
export const EXPRESSIONS = {
  neutral:     { browL: 2,   browR: -2,  browY: 0,   lid: 0.08, beakOpen: 0.05, headRot: 0,  headY: 0, pupil: 1.0,  pupilY: 0 },
  bright:      { browL: -10, browR: 10,  browY: -6,  lid: 0.0,  beakOpen: 0.5,  headRot: 0,  headY: 0, pupil: 1.05, pupilY: 0 },
  unimpressed: { browL: 14,  browR: -14, browY: 4,   lid: 0.55, beakOpen: 0.0,  headRot: 0,  headY: 1, pupil: 0.92, pupilY: 0 },
  happy:       { browL: -8,  browR: 8,   browY: -4,  lid: 0.15, beakOpen: 0.3,  headRot: 2,  headY: 0, pupil: 1.0,  pupilY: 0 },
  laugh:       { browL: -10, browR: 10,  browY: -7,  lid: 0.85, beakOpen: 1.0,  headRot: 0,  headY: -3, pupil: 1.0, pupilY: 0 },
  think:       { browL: 14,  browR: 2,   browY: -2,  lid: 0.3,  beakOpen: 0.0,  headRot: 4,  headY: 0, pupil: 0.85, pupilY: -6 },
  surprised:   { browL: -14, browR: 14,  browY: -10, lid: 0.0,  beakOpen: 0.55, headRot: 0,  headY: -2, pupil: 0.7, pupilY: 0 },
  annoyed:     { browL: 20,  browR: -20, browY: 6,   lid: 0.5,  beakOpen: 0.0,  headRot: -2, headY: 1, pupil: 0.85, pupilY: 0 },
  sad:         { browL: -18, browR: 18,  browY: -2,  lid: 0.45, beakOpen: 0.0,  headRot: 2,  headY: 3, pupil: 0.95, pupilY: 2 },
  determined:  { browL: 12,  browR: -12, browY: 2,   lid: 0.15, beakOpen: 0.15, headRot: 0,  headY: 0, pupil: 1.0,  pupilY: 0 },
  skeptical:   { browL: -12, browR: 4,   browY: -2,  lid: 0.4,  beakOpen: 0.0,  headRot: 3,  headY: 0, pupil: 0.9,  pupilY: 0 },
  excited:     { browL: -12, browR: 12,  browY: -10, lid: 0.0,  beakOpen: 0.85, headRot: 0,  headY: -2, pupil: 1.1, pupilY: 0 },
};

export const EMOTES = {
  wave:     { anim: 'wave',    expr: 'happy' },
  laugh:    { anim: 'laugh',   expr: 'laugh' },
  think:    { anim: 'think',   expr: 'think' },
  shrug:    { anim: 'shrug',   expr: 'skeptical' },
  excited:  { anim: 'excited', expr: 'excited' },
  nod:      { anim: 'nod',     expr: 'happy' },
  sigh:     { anim: 'shrug',   expr: 'unimpressed' },
  smile:    { anim: null,      expr: 'happy' },
  surprised:{ anim: null,      expr: 'surprised' },
  sad:      { anim: null,      expr: 'sad' },
  determined:{ anim: null,     expr: 'determined' },
};

// Static poses for the character sheet. Flipper degrees: raise-outward is
// positive for L, negative for R.
export const POSES = {
  stand:    { fL: 0,   fR: 0,    bodyRot: 0,  bodyY: 0, expr: null },
  wave:     { fL: 0,   fR: -150, bodyRot: -1, bodyY: 0, expr: 'happy' },
  openArms: { fL: 145, fR: -145, bodyRot: 0,  bodyY: 0, expr: 'excited' },
  think:    { fL: 0,   fR: -100, bodyRot: 2,  bodyY: 0, expr: 'think' },
  shrug:    { fL: 60,  fR: -60,  bodyRot: 0,  bodyY: -3, expr: 'skeptical' },
  point:    { fL: 0,   fR: -120, bodyRot: -2, bodyY: 0, expr: 'determined' },
  stride:   { fL: 25,  fR: -25,  bodyRot: 4,  bodyY: -2, stride: 26, expr: 'happy' },
  slump:    { fL: 8,   fR: -8,   bodyRot: 0,  bodyY: 5,  expr: 'unimpressed' },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ============================================================ SVG authoring
const NS = 'http://www.w3.org/2000/svg';

function defs(c) {
  const seeds = [2, 9, 17];
  const filters = seeds.map((s, i) => `
    <filter id="boil-${c.id}-${i}" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="0.013 0.019" numOctaves="2" seed="${s}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="4.5"/>
    </filter>`).join('');
  const e = c.eye;
  return `<defs>${filters}
    <pattern id="hatch-${c.id}" width="7" height="7" patternTransform="rotate(38)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="7" stroke="${c.line}" stroke-width="1.1" opacity="0.45"/>
    </pattern>
    <clipPath id="eyeclipL-${c.id}"><ellipse cx="${e.lx}" cy="${e.cy}" rx="${e.rW}" ry="${e.rH}"/></clipPath>
    <clipPath id="eyeclipR-${c.id}"><ellipse cx="${e.rx}" cy="${e.cy}" rx="${e.rW}" ry="${e.rH}"/></clipPath>
  </defs>`;
}

const stroke = (c, w = 3.4) => `fill="none" stroke="${c.line}" stroke-width="${w}" stroke-linecap="round" stroke-opacity="0.9"`;
const filled = (c, fill, w = 3.4) => `fill="${fill}" stroke="${c.line}" stroke-width="${w}" stroke-linejoin="round" stroke-opacity="0.9"`;

// ---------- NPC front ----------
// Traced from the model sheet: tall slim egg, dark "hood" over crown/shoulders,
// almond eyes under a heavy V-brow, pointed downturned beak, crest swept right,
// dark pointed wings, splayed three-toed feet.
function npcFront(c) {
  const body = `M200,78 C162,80 138,102 132,138 C127,168 118,196 106,232 C94,268 88,306 90,340 C92,382 128,412 200,414 C272,412 308,382 310,340 C312,306 306,268 294,232 C282,196 273,168 268,138 C262,102 238,80 200,78 Z`;
  const hood = `M106,232 C118,196 127,168 132,138 C138,102 162,80 200,78 C238,80 262,102 268,138 C273,168 282,196 294,232 C268,214 250,196 246,170 C230,184 216,191 200,193 C184,191 170,184 154,170 C150,196 132,214 106,232 Z`;
  return `
  <g class="root">
    <g class="body">
      <path d="${body}" ${filled(c, c.body)}/>
      <path d="${body}" fill="url(#hatch-${c.id})" stroke="none" opacity="0.3"/>
      <ellipse class="bellyShape" cx="200" cy="308" rx="74" ry="96" ${filled(c, c.belly)}/>
      <path d="${hood}" fill="${c.dark}" stroke="${c.line}" stroke-width="3" stroke-linejoin="round" stroke-opacity="0.75"/>
      <path d="${hood}" fill="url(#hatch-${c.id})" stroke="none" opacity="0.4"/>
      <g class="flipperL"><path d="M106,230 C90,264 82,304 86,344 C88,366 102,372 112,356 C124,336 128,288 122,246 Z" ${filled(c, c.dark)}/></g>
      <g class="flipperR"><path d="M294,230 C310,264 318,304 314,344 C312,366 298,372 288,356 C276,336 272,288 278,246 Z" ${filled(c, c.dark)}/></g>
      <g class="head">
        <g class="tuft">
          <path d="M160,100 C164,80 176,66 192,60" ${stroke(c, 4.5)}/>
          <path d="M170,92 C180,66 200,54 226,56" ${stroke(c, 5)}/>
          <path d="M180,86 C192,64 212,56 232,62" ${stroke(c, 4.5)}/>
          <path d="M192,82 C204,64 220,60 236,68" ${stroke(c, 4)}/>
        </g>
        <g class="eyes">
          <ellipse cx="163" cy="152" rx="36" ry="27" ${filled(c, '#fbf8ef', 3.2)}/>
          <ellipse cx="237" cy="152" rx="36" ry="27" ${filled(c, '#fbf8ef', 3.2)}/>
          <g class="pupilL"><circle cx="180" cy="158" r="7.5" fill="#35302b"/></g>
          <g class="pupilR"><circle cx="220" cy="158" r="7.5" fill="#35302b"/></g>
          <g clip-path="url(#eyeclipL-${c.id})"><g class="lidL"><rect x="117" y="115" width="92" height="74" fill="${c.dark}"/><line x1="117" y1="189" x2="209" y2="189" stroke="${c.line}" stroke-width="3.2" stroke-opacity="0.85"/></g></g>
          <g clip-path="url(#eyeclipR-${c.id})"><g class="lidR"><rect x="191" y="115" width="92" height="74" fill="${c.dark}"/><line x1="191" y1="189" x2="283" y2="189" stroke="${c.line}" stroke-width="3.2" stroke-opacity="0.85"/></g></g>
          <g class="browL"><path d="M122,126 L204,142" ${stroke(c, c.browWidth)}/></g>
          <g class="browR"><path d="M196,142 L278,126" ${stroke(c, c.browWidth)}/></g>
        </g>
        <g class="beak">
          <path class="mouthShape" d="M172,206 C190,222 210,222 228,206 C216,238 184,238 172,206 Z" fill="#3d3833" stroke="none"/>
          <g class="jaw"><path d="M180,214 C190,224 210,224 220,214 C212,230 188,230 180,214 Z" ${filled(c, c.beak, 3)}/></g>
          <path d="M162,182 C176,172 224,172 238,182 C232,200 214,218 200,222 C186,218 168,200 162,182 Z" ${filled(c, c.beak)}/>
          <path d="M200,184 L200,216" ${stroke(c, 2.4)}/>
        </g>
      </g>
    </g>
    <g class="footL"><path d="M118,424 a15,12 0 0 1 26,-8 a13,11 0 0 1 22,0 a15,12 0 0 1 26,8 z" ${filled(c, c.foot, 3)}/></g>
    <g class="footR"><path d="M208,424 a15,12 0 0 1 26,-8 a13,11 0 0 1 22,0 a15,12 0 0 1 26,8 z" ${filled(c, c.foot, 3)}/></g>
  </g>`;
}

// ---------- CAP front ----------
// Traced from the model sheet: chibi proportions (big head, small body), dark cap
// over a generous white face, vertical-oval eyes with big pupils, thin arched
// brows, and a large open smiling beak; expressive arm-like wings.
function capFront(c) {
  // Egg-shaped head: narrow crown, cheeks fullest down by the beak, soft
  // transition into the body (per the model sheet — not a ball on a body).
  const body = `M200,82 C162,84 138,106 130,146 C124,182 130,218 152,242 C128,264 114,300 114,340 C114,384 148,412 200,414 C252,412 286,384 286,340 C286,300 272,264 248,242 C270,218 276,182 270,146 C262,106 238,84 200,82 Z`;
  const face = `M200,112 C168,108 146,128 142,162 C139,196 152,226 174,240 C152,260 140,296 140,336 C140,380 164,404 200,406 C236,404 260,380 260,336 C260,296 248,260 226,240 C248,226 261,196 258,162 C254,128 232,108 200,112 Z`;
  return `
  <g class="root">
    <g class="body">
      <path d="${body}" ${filled(c, c.body)}/>
      <path d="${body}" fill="url(#hatch-${c.id})" stroke="none" opacity="0.35"/>
      <g class="flipperL"><path d="M118,258 C90,278 72,308 68,336 C66,354 82,358 96,346 C114,330 124,296 126,266 Z" ${filled(c, c.body)}/></g>
      <g class="flipperR"><path d="M282,258 C310,278 328,308 332,336 C334,354 318,358 304,346 C286,330 276,296 274,266 Z" ${filled(c, c.body)}/></g>
      <g class="head">
        <path class="faceShape" d="${face}" ${filled(c, c.belly)}/>
        <g class="tuft">
          <path d="M180,86 q-8,-26 -18,-34" ${stroke(c, 4)}/>
          <path d="M192,82 q-3,-28 -10,-38" ${stroke(c, 4)}/>
          <path d="M204,80 q2,-28 9,-36" ${stroke(c, 4)}/>
          <path d="M216,84 q10,-24 20,-30" ${stroke(c, 4)}/>
        </g>
        <g class="eyes">
          <ellipse cx="172" cy="152" rx="23" ry="31" ${filled(c, '#fdfaf2', 3.2)}/>
          <ellipse cx="228" cy="152" rx="23" ry="31" ${filled(c, '#fdfaf2', 3.2)}/>
          <g class="pupilL"><circle cx="176" cy="158" r="12.5" fill="#322d28"/><circle cx="181" cy="152" r="3.5" fill="#fdfaf2" opacity="0.9"/></g>
          <g class="pupilR"><circle cx="224" cy="158" r="12.5" fill="#322d28"/><circle cx="229" cy="152" r="3.5" fill="#fdfaf2" opacity="0.9"/></g>
          <g clip-path="url(#eyeclipL-${c.id})"><g class="lidL"><rect x="126" y="111" width="92" height="82" fill="${c.belly}"/><line x1="126" y1="193" x2="218" y2="193" stroke="${c.line}" stroke-width="3.2" stroke-opacity="0.85"/></g></g>
          <g clip-path="url(#eyeclipR-${c.id})"><g class="lidR"><rect x="182" y="111" width="92" height="82" fill="${c.belly}"/><line x1="182" y1="193" x2="274" y2="193" stroke="${c.line}" stroke-width="3.2" stroke-opacity="0.85"/></g></g>
          <g class="browL"><path d="M148,122 Q172,106 196,118" ${stroke(c, c.browWidth)}/></g>
          <g class="browR"><path d="M204,118 Q228,106 252,122" ${stroke(c, c.browWidth)}/></g>
        </g>
        <g class="beak">
          <path class="mouthShape" d="M148,204 C174,244 226,244 252,204 C246,264 154,264 148,204 Z" fill="#4a4237" stroke="none"/>
          <g class="jaw"><path d="M162,240 C186,256 214,256 238,240 C226,268 174,268 162,240 Z" ${filled(c, c.beak, 3)}/></g>
          <path d="M148,190 C164,178 236,178 252,190 C246,208 224,222 200,224 C176,222 154,208 148,190 Z" ${filled(c, c.beak)}/>
          <path d="M150,206 q-9,-3 -12,-11 M250,206 q9,-3 12,-11" ${stroke(c, 3)}/>
        </g>
      </g>
    </g>
    <g class="footL"><path d="M124,424 a16,13 0 0 1 28,-8 a14,12 0 0 1 24,0 a16,13 0 0 1 28,8 z" ${filled(c, c.foot, 3)}/></g>
    <g class="footR"><path d="M196,424 a16,13 0 0 1 28,-8 a14,12 0 0 1 24,0 a16,13 0 0 1 28,8 z" ${filled(c, c.foot, 3)}/></g>
  </g>`;
}

// ---------- static side / back views (for the character sheet) ----------
function sideView(c) {
  const npc = c.id === 'npc';
  const dark = npc ? c.dark : c.body;
  const brow = npc
    ? `<path d="M236,110 L294,122" ${stroke(c, 12)}/>`
    : `<path d="M238,96 Q262,84 286,94" ${stroke(c, 5)}/>`;
  const beak = npc
    ? `<path d="M292,172 C330,168 366,178 380,192 C366,204 332,208 292,204 Z" ${filled(c, c.beak)}/>
       <path d="M298,204 C330,210 356,206 372,196" ${stroke(c, 2.6)}/>`
    : `<path d="M292,180 C324,178 348,186 358,196 C346,204 322,206 294,204 Z" ${filled(c, c.beak)}/>
       <path d="M294,208 C318,222 342,220 352,210 C338,232 304,234 292,214 Z" ${filled(c, c.beak)}/>
       <path d="M293,204 C316,212 340,210 354,200 C340,216 310,218 293,208 Z" fill="#463c36" stroke="none"/>`;
  const tuft = npc
    ? `<path d="M212,64 q-20,-16 -36,-16 M232,60 q-10,-22 -26,-28 M252,62 q0,-24 -10,-32" ${stroke(c, 4)}/>`
    : `<path d="M212,58 q-10,-26 -22,-33 M228,54 q-2,-28 6,-38 M244,58 q12,-22 24,-28" ${stroke(c, 4)}/>`;
  return `
  <g class="root">
    <path d="M226,64 C170,68 140,116 138,176 C136,226 106,256 100,312 C94,372 150,406 218,406 C290,406 336,368 330,306 C324,248 302,220 300,170 C298,112 278,62 226,64 Z" ${filled(c, dark)}/>
    <path d="M226,64 C170,68 140,116 138,176 C136,226 106,256 100,312 C94,372 150,406 218,406 C290,406 336,368 330,306 C324,248 302,220 300,170 C298,112 278,62 226,64 Z" fill="url(#hatch-${c.id})" stroke="none" opacity="0.32"/>
    <path d="M300,236 C322,268 326,330 300,368 C280,394 240,402 218,398 C266,388 296,342 292,290 C290,262 296,246 300,236 Z" ${filled(c, c.belly)}/>
    <path d="M150,220 C128,252 122,304 132,340 C138,358 160,352 170,326 C180,294 176,250 168,222 Z" ${filled(c, dark)}/>
    ${tuft}
    <ellipse cx="266" cy="148" rx="34" ry="44" ${filled(c, npc ? '#fbf8ef' : '#fdfaf2')}/>
    ${npc
      ? `<path d="M232,128 C240,116 292,116 298,130 L298,150 C280,142 246,142 232,152 Z" fill="${c.body}" stroke="${c.line}" stroke-width="3"/>
         <circle cx="282" cy="158" r="10" fill="#35302b"/>`
      : `<circle cx="272" cy="150" r="15" fill="#322d28"/><circle cx="278" cy="144" r="4" fill="#fdfaf2" opacity="0.9"/>`}
    ${brow}
    ${beak}
    <path d="M104,330 q-18,10 -22,26 q14,-4 26,-14" ${filled(c, c.body, 3)}/>
    <path d="M188,406 a16,13 0 0 1 28,-8 a14,12 0 0 1 24,1 a15,12 0 0 1 22,8 z" ${filled(c, c.foot, 3)}/>
  </g>`;
}

function backView(c) {
  const dark = c.id === 'npc' ? c.dark : c.body;
  const tuft = c.id === 'npc'
    ? `<path d="M176,62 q-12,-18 -26,-22 M196,58 q-4,-24 -14,-32 M218,58 q6,-22 16,-28" ${stroke(c, 4)}/>`
    : `<path d="M184,60 q-8,-26 -18,-34 M200,56 q-2,-28 4,-38 M216,60 q10,-24 20,-30" ${stroke(c, 4)}/>`;
  return `
  <g class="root">
    <path d="M200,62 C150,64 122,110 118,166 C115,212 78,246 70,308 C63,372 126,406 200,406 C274,406 337,372 330,308 C322,246 285,212 282,166 C278,110 250,64 200,62 Z" ${filled(c, dark)}/>
    <path d="M200,62 C150,64 122,110 118,166 C115,212 78,246 70,308 C63,372 126,406 200,406 C274,406 337,372 330,308 C322,246 285,212 282,166 C278,110 250,64 200,62 Z" fill="url(#hatch-${c.id})" stroke="none" opacity="0.4"/>
    ${tuft}
    <path d="M92,220 C68,250 58,300 68,338 C74,354 94,348 104,322 Z" ${filled(c, dark)}/>
    <path d="M308,220 C332,250 342,300 332,338 C326,354 306,348 296,322 Z" ${filled(c, dark)}/>
    <path d="M182,368 C190,388 210,388 218,368 C214,394 186,394 182,368 Z" ${filled(c, dark)}/>
    <path d="M128,404 a14,11 0 0 1 24,-6 a12,10 0 0 1 20,0 a14,11 0 0 1 22,8 z" ${filled(c, c.foot, 3)}/>
    <path d="M206,406 a14,11 0 0 1 22,-8 a12,10 0 0 1 20,0 a14,11 0 0 1 24,6 z" ${filled(c, c.foot, 3)}/>
  </g>`;
}

export function buildSVG(config, view = 'front') {
  const inner = view === 'front'
    ? (config.id === 'npc' ? npcFront(config) : capFront(config))
    : view === 'side' ? sideView(config) : backView(config);
  return `<svg xmlns="${NS}" viewBox="0 0 400 440" width="400" height="440" class="penguin-svg penguin-${config.id}">
    ${defs(config)}
    <g class="boil" filter="url(#boil-${config.id}-0)">${inner}</g>
  </svg>`;
}

// ============================================================ rigged puppet
export class SketchPenguin {
  constructor(config, mountEl) {
    this.cfg = config;
    this.el = mountEl;
    this.el.innerHTML = buildSVG(config, 'front');
    this.svg = this.el.querySelector('svg');
    const q = (s) => this.svg.querySelector(s);
    this.parts = {
      boil: q('.boil'),
      root: q('.root'),
      body: q('.body'),
      head: q('.head'),
      flipperL: q('.flipperL'),
      flipperR: q('.flipperR'),
      browL: q('.browL'),
      browR: q('.browR'),
      lidL: q('.lidL'),
      lidR: q('.lidR'),
      pupilL: q('.pupilL'),
      pupilR: q('.pupilR'),
      jaw: q('.jaw'),
      mouth: q('.mouthShape'),
      footL: q('.footL'),
      footR: q('.footR'),
    };
    // transform origins (userSpace px within the 400x440 viewBox)
    const npc = config.id === 'npc';
    this._origins = {
      body: '200px 414px',
      head: '200px 250px',
      flipperL: npc ? '112px 236px' : '120px 262px',
      flipperR: npc ? '288px 236px' : '280px 262px',
      browL: npc ? '163px 134px' : '172px 116px',
      browR: npc ? '237px 134px' : '228px 116px',
      root: '200px 414px',
    };
    for (const k of ['body', 'head', 'flipperL', 'flipperR', 'browL', 'browR', 'root']) {
      this.parts[k].style.transformOrigin = this._origins[k];
    }
    this.parts.mouth.style.transformOrigin = npc ? '200px 206px' : '200px 208px';
    this.parts.lidL.style.transformOrigin = `${config.eye.lx}px ${config.eye.cy}px`;
    this.parts.lidR.style.transformOrigin = `${config.eye.rx}px ${config.eye.cy}px`;
    this._pupilOrigins = npc
      ? ['180px 158px', '220px 158px']
      : ['176px 158px', '224px 158px'];

    // world position in stage percent (x) — the stage moves this.el
    this.x = 0;
    this.facing = 1;
    this.state = 'idle';
    this.stateTime = 0;
    this.stateDur = Infinity;
    this.talking = false;
    this.talkPhase = Math.random() * 10;
    this.blinkTimer = 1.5 + Math.random() * 3;
    this.blink = 0;
    this.walk = null;
    this._boilT = 0;
    this._boilIdx = 0;
    this._talkOpen = 0;
    this.exprCurrent = { ...EXPRESSIONS[config.defaultExpression] };
    this.exprTarget = { ...EXPRESSIONS[config.defaultExpression] };
    this.baseExpression = config.defaultExpression;
    this.exprHoldTimer = 0;
    this._apply(this.exprCurrent, {});
  }

  setExpression(name, holdSeconds = 0) {
    const e = EXPRESSIONS[name];
    if (!e) return;
    this.exprTarget = { ...e };
    if (holdSeconds > 0) this.exprHoldTimer = holdSeconds;
    else this.baseExpression = name;
  }

  play(name, duration = 2.2) {
    this.state = name;
    this.stateTime = 0;
    this.stateDur = duration;
    const emote = EMOTES[name];
    if (emote && emote.expr) this.setExpression(emote.expr, duration);
  }

  setTalking(on) {
    this.talking = on;
    if (on && this.state === 'idle') { this.state = 'talk'; this.stateTime = 0; this.stateDur = Infinity; }
    if (!on && this.state === 'talk') { this.state = 'idle'; this.stateTime = 0; this.stateDur = Infinity; }
  }

  walkTo(xPercent, speed = 22) { // speed in stage-% per second
    this.walk = { toX: xPercent, speed };
    this.state = 'waddle';
    this.stateTime = 0;
    this.stateDur = Infinity;
  }

  faceToward() { /* front-facing sketch — no-op, kept for API compatibility */ }

  // Static pose for the character sheet.
  setPose(name, exprOverride = null) {
    const p = POSES[name] || POSES.stand;
    this.talking = false;
    this.blink = 0;
    this._talkOpen = 0;
    this.exprCurrent = { ...EXPRESSIONS[exprOverride || p.expr || this.cfg.defaultExpression] };
    this._apply(this.exprCurrent, {
      fL: p.fL, fR: p.fR,
      bodyRot: p.bodyRot, bodyY: p.bodyY,
      strideL: p.stride ? p.stride : 0, strideR: p.stride ? -p.stride : 0,
    });
  }

  _apply(e, m) {
    const p = this.parts;
    const lid = Math.max(e.lid, this.blink);
    // eyelids slide down over the eyes (NPC gets a slight angry skew)
    const skew = this.cfg.lidSkew;
    const lidRange = this.cfg.eye.rH * 2 + 20;
    p.lidL.style.transform = `translateY(${-lidRange * (1 - lid)}px) rotate(${skew}deg)`;
    p.lidR.style.transform = `translateY(${-lidRange * (1 - lid)}px) rotate(${-skew}deg)`;
    p.browL.style.transform = `translateY(${e.browY + (m.browLift || 0)}px) rotate(${e.browL}deg)`;
    p.browR.style.transform = `translateY(${e.browY + (m.browLift || 0)}px) rotate(${e.browR}deg)`;
    p.pupilL.style.transform = `translateY(${e.pupilY}px) scale(${e.pupil})`;
    p.pupilR.style.transform = `translateY(${e.pupilY}px) scale(${e.pupil})`;
    p.pupilL.style.transformOrigin = this._pupilOrigins[0];
    p.pupilR.style.transformOrigin = this._pupilOrigins[1];
    const open = clamp(this.talking ? Math.max(e.beakOpen, this._talkOpen) : e.beakOpen, 0, 1);
    p.jaw.style.transform = `translateY(${open * this.cfg.jawTravel}px)`;
    p.mouth.style.transform = `scaleY(${0.12 + open * 0.88})`;
    p.head.style.transform = `translateY(${e.headY + (m.headY || 0)}px) rotate(${e.headRot + (m.headRot || 0)}deg)`;
    p.body.style.transform = `translateY(${m.bodyY || 0}px) rotate(${m.bodyRot || 0}deg)`;
    p.flipperL.style.transform = `rotate(${m.fL || 0}deg)`;
    p.flipperR.style.transform = `rotate(${m.fR || 0}deg)`;
    p.footL.style.transform = `translate(0px, ${-(m.footLY || 0)}px) translateX(${m.strideL || 0}px)`;
    p.footR.style.transform = `translate(0px, ${-(m.footRY || 0)}px) translateX(${m.strideR || 0}px)`;
    p.root.style.transform = `translateY(${m.rootY || 0}px) rotate(${m.rootRot || 0}deg)`;
  }

  update(dt, t) {
    this.stateTime += dt;
    const st = this.stateTime;
    const phase = this.talkPhase;

    // boiling pencil line: re-jitter the wobble a few times a second
    this._boilT += dt;
    if (this._boilT > 0.16) {
      this._boilT = 0;
      this._boilIdx = (this._boilIdx + 1) % 3;
      this.parts.boil.setAttribute('filter', `url(#boil-${this.cfg.id}-${this._boilIdx})`);
    }

    // blink
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) { this.blinkTimer = 2 + Math.random() * 4; this.blink = 1; }
    if (this.blink > 0) this.blink = Math.max(0, this.blink - dt * 7);

    // expression lerp + hold expiry
    if (this.exprHoldTimer > 0) {
      this.exprHoldTimer -= dt;
      if (this.exprHoldTimer <= 0) this.exprTarget = { ...EXPRESSIONS[this.baseExpression] };
    }
    for (const k in this.exprTarget) {
      this.exprCurrent[k] = lerp(this.exprCurrent[k], this.exprTarget[k], Math.min(1, dt * 7));
    }

    this._talkOpen = this.talking
      ? 0.25 + 0.35 * Math.abs(Math.sin(t * 9 + phase)) + 0.15 * Math.sin(t * 23 + phase)
      : 0;

    // ---- motion layers
    const m = {
      bodyY: Math.sin(t * 1.7 + phase) * 2.2,
      bodyRot: Math.sin(t * 0.8 + phase) * 0.6,
      headRot: Math.sin(t * 1.1 + phase) * 1.2,
      headY: 0,
      fL: Math.sin(t * 1.4 + phase) * 2.5,
      fR: -Math.sin(t * 1.4 + phase + 1) * 2.5,
      footLY: 0, footRY: 0, rootY: 0, rootRot: 0, strideL: 0, strideR: 0,
    };

    const s = this.state;
    if (s === 'talk' || this.talking) {
      m.headRot += Math.sin(t * 3.1 + phase) * 1.6;
      if (this.cfg.id === 'cap') {
        m.fR = -(30 + 28 * Math.sin(t * 2.6 + phase)) * 1.3;
        m.fL = Math.max(0, Math.sin(t * 1.9 + phase + 2)) * 36;
      } else {
        m.fR = -Math.max(0, Math.sin(t * 1.5 + phase)) * 14;
      }
    } else if (s === 'wave') {
      const k = Math.min(1, st * 4);
      m.fR = -k * 148 + Math.sin(st * 10) * 24 * k;
      m.headRot += 3 * k;
    } else if (s === 'laugh') {
      const b = Math.abs(Math.sin(st * 9));
      m.bodyY -= b * 8;
      m.headY = -4;
      m.fL = 14 + b * 20;
      m.fR = -14 - b * 20;
    } else if (s === 'think') {
      const k = Math.min(1, st * 3);
      m.fR = -k * 98;
      m.headRot += 4 * k;
    } else if (s === 'shrug') {
      const k = Math.min(1, st * 4) * (this.stateDur - st > 0.4 ? 1 : Math.max(0, (this.stateDur - st) / 0.4));
      m.fL = k * 58;
      m.fR = -k * 58;
      m.bodyY -= k * 4;
      m.browLift = -k * 4;
    } else if (s === 'excited') {
      const hop = Math.abs(Math.sin(st * 7));
      m.rootY = -hop * 16;
      m.fL = 150 + Math.sin(st * 7) * 12;
      m.fR = -150 - Math.sin(st * 7) * 12;
    } else if (s === 'nod') {
      m.headY = Math.sin(st * 8) * 5;
    } else if (s === 'waddle' && this.walk) {
      const { toX, speed } = this.walk;
      const dx = toX - this.x;
      const dist = Math.abs(dx);
      if (dist < 0.4) {
        this.walk = null;
        this.state = 'idle';
      } else {
        this.x += Math.sign(dx) * Math.min(dist, speed * dt);
        const w = t * 10;
        m.rootRot = Math.sin(w) * 5;
        m.bodyY -= Math.abs(Math.sin(w)) * 3;
        m.footLY = Math.max(0, Math.sin(w)) * 9;
        m.footRY = Math.max(0, -Math.sin(w)) * 9;
      }
    }

    if (st > this.stateDur && s !== 'waddle') {
      this.state = this.talking ? 'talk' : 'idle';
      this.stateTime = 0;
      this.stateDur = Infinity;
    }

    this._apply(this.exprCurrent, m);
  }
}
