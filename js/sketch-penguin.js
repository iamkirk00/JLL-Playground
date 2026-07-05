// sketch-penguin.js — "living sketch" 2D puppets.
// Each penguin is layered pencil-style SVG traced from the original concept art:
// wobbly graphite strokes, hatch shading, cream paper — rigged for animation with
// a boiling-line effect (the wobble re-jitters like hand-drawn pencil animation).

export const PENGUIN_CONFIGS = {
  npc: {
    id: 'npc',
    body: '#8b8478',
    belly: '#f5efdf',
    beak: '#b7ad98',
    foot: '#cfc6ae',
    line: '#46403a',
    facePatch: false,
    tuft: 'fringe',
    defaultExpression: 'unimpressed',
    browWidth: 15,
  },
  cap: {
    id: 'cap',
    body: '#a49c8f',
    belly: '#f7f1e2',
    beak: '#c4b89e',
    foot: '#d6cdb5',
    line: '#46403a',
    facePatch: true,
    tuft: 'spiky',
    defaultExpression: 'bright',
    browWidth: 5,
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
  return `<defs>${filters}
    <pattern id="hatch-${c.id}" width="7" height="7" patternTransform="rotate(38)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="7" stroke="${c.line}" stroke-width="1.1" opacity="0.45"/>
    </pattern>
    <clipPath id="eyeclipL-${c.id}"><ellipse cx="${c.id === 'npc' ? 163 : 166}" cy="${c.id === 'npc' ? 150 : 146}" rx="${c.id === 'npc' ? 42 : 46}" ry="${c.id === 'npc' ? 48 : 47}"/></clipPath>
    <clipPath id="eyeclipR-${c.id}"><ellipse cx="${c.id === 'npc' ? 237 : 240}" cy="${c.id === 'npc' ? 150 : 146}" rx="${c.id === 'npc' ? 42 : 46}" ry="${c.id === 'npc' ? 48 : 47}"/></clipPath>
  </defs>`;
}

const stroke = (c, w = 3.4) => `fill="none" stroke="${c.line}" stroke-width="${w}" stroke-linecap="round" stroke-opacity="0.9"`;
const filled = (c, fill, w = 3.4) => `fill="${fill}" stroke="${c.line}" stroke-width="${w}" stroke-linejoin="round" stroke-opacity="0.9"`;

// ---------- NPC front ----------
function npcFront(c) {
  const body = `M200,66 C148,68 120,112 116,168 C113,214 76,246 68,308 C61,372 124,406 200,406 C276,406 339,372 332,308 C324,246 287,214 284,168 C280,112 252,68 200,66 Z`;
  return `
  <g class="root">
    <g class="body">
      <path d="${body}" ${filled(c, c.body)}/>
      <path d="${body}" fill="url(#hatch-${c.id})" stroke="none" opacity="0.35"/>
      <g class="flipperL"><path d="M84,216 C58,246 46,296 56,336 C62,352 84,346 94,320 C104,288 102,250 96,222 Z" ${filled(c, c.body)}/></g>
      <g class="flipperR"><path d="M316,216 C342,246 354,296 344,336 C338,352 316,346 306,320 C296,288 298,250 304,222 Z" ${filled(c, c.body)}/></g>
      <ellipse class="bellyShape" cx="200" cy="302" rx="104" ry="92" ${filled(c, c.belly)}/>
      <g class="head">
        <g class="tuft">
          <path d="M162,64 c12,-18 32,-22 50,-12" ${stroke(c, 4)}/>
          <path d="M178,56 c16,-16 38,-14 50,0" ${stroke(c, 4)}/>
          <path d="M196,50 c16,-10 34,-4 42,10" ${stroke(c, 4)}/>
          <path d="M214,48 c14,-6 28,2 34,14" ${stroke(c, 4)}/>
        </g>
        <g class="eyes">
          <ellipse cx="163" cy="150" rx="42" ry="48" ${filled(c, '#fbf8ef')}/>
          <ellipse cx="237" cy="150" rx="42" ry="48" ${filled(c, '#fbf8ef')}/>
          <g class="pupilL"><circle cx="170" cy="160" r="10.5" fill="#35302b"/><circle cx="174" cy="156" r="3" fill="#fbf8ef" opacity="0.85"/></g>
          <g class="pupilR"><circle cx="230" cy="160" r="10.5" fill="#35302b"/><circle cx="234" cy="156" r="3" fill="#fbf8ef" opacity="0.85"/></g>
          <g clip-path="url(#eyeclipL-${c.id})"><g class="lidL"><rect x="111" y="88" width="104" height="124" fill="${c.body}"/><line x1="111" y1="212" x2="215" y2="212" stroke="${c.line}" stroke-width="3.5" stroke-opacity="0.85"/></g></g>
          <g clip-path="url(#eyeclipR-${c.id})"><g class="lidR"><rect x="185" y="88" width="104" height="124" fill="${c.body}"/><line x1="185" y1="212" x2="289" y2="212" stroke="${c.line}" stroke-width="3.5" stroke-opacity="0.85"/></g></g>
          <g class="browL"><path d="M126,102 L202,112" ${stroke(c, c.browWidth)}/></g>
          <g class="browR"><path d="M198,112 L274,102" ${stroke(c, c.browWidth)}/></g>
        </g>
        <g class="beak">
          <path class="mouthShape" d="M150,206 C175,224 225,224 250,206 C235,238 165,238 150,206 Z" fill="#3d3833" stroke="none"/>
          <g class="jaw"><path d="M148,214 C172,230 228,230 252,214 C230,240 170,240 148,214 Z" ${filled(c, c.beak)}/></g>
          <path d="M112,198 C152,182 248,182 288,198 C268,214 236,222 200,222 C164,222 132,214 112,198 Z" ${filled(c, c.beak)}/>
          <path d="M112,198 q-7,5 -9,14 M288,198 q7,5 9,14" ${stroke(c, 3)}/>
        </g>
      </g>
    </g>
    <g class="footL"><path d="M116,406 a15,13 0 0 1 27,-7 a13,12 0 0 1 23,0 a15,13 0 0 1 25,9 z" ${filled(c, c.foot, 3)}/></g>
    <g class="footR"><path d="M209,408 a15,13 0 0 1 25,-9 a13,12 0 0 1 23,0 a15,13 0 0 1 27,7 z" ${filled(c, c.foot, 3)}/></g>
  </g>`;
}

// ---------- CAP front ----------
function capFront(c) {
  const body = `M204,60 C156,62 130,104 128,158 C126,204 92,240 86,300 C80,364 138,402 206,402 C274,402 330,364 324,300 C318,240 286,204 284,158 C282,104 252,62 204,60 Z`;
  return `
  <g class="root">
    <g class="body">
      <path d="${body}" ${filled(c, c.body)}/>
      <path d="${body}" fill="url(#hatch-${c.id})" stroke="none" opacity="0.3"/>
      <g class="flipperL"><path d="M100,212 C76,240 66,290 74,328 C80,344 100,338 110,314 C118,284 116,246 110,216 Z" ${filled(c, c.body)}/></g>
      <g class="flipperR"><path d="M308,212 C332,240 342,290 334,328 C328,344 308,338 298,314 C290,284 292,246 298,216 Z" ${filled(c, c.body)}/></g>
      <ellipse class="bellyShape" cx="205" cy="298" rx="97" ry="100" ${filled(c, c.belly)}/>
      <g class="head">
        <ellipse class="faceShape" cx="204" cy="150" rx="80" ry="64" ${filled(c, c.belly)}/>
        <g class="tuft">
          <path d="M182,62 q-9,-26 -20,-35" ${stroke(c, 4)}/>
          <path d="M196,58 q-4,-28 -11,-38" ${stroke(c, 4)}/>
          <path d="M208,56 q3,-28 10,-37" ${stroke(c, 4)}/>
          <path d="M222,60 q11,-24 22,-31" ${stroke(c, 4)}/>
        </g>
        <g class="eyes">
          <circle cx="166" cy="146" r="46" ${filled(c, '#fdfaf2')}/>
          <circle cx="240" cy="146" r="46" ${filled(c, '#fdfaf2')}/>
          <g class="pupilL"><circle cx="173" cy="150" r="16" fill="#322d28"/><circle cx="179" cy="144" r="4.5" fill="#fdfaf2" opacity="0.9"/></g>
          <g class="pupilR"><circle cx="233" cy="150" r="16" fill="#322d28"/><circle cx="239" cy="144" r="4.5" fill="#fdfaf2" opacity="0.9"/></g>
          <g clip-path="url(#eyeclipL-${c.id})"><g class="lidL"><rect x="114" y="86" width="104" height="120" fill="${c.belly}"/><line x1="114" y1="206" x2="218" y2="206" stroke="${c.line}" stroke-width="3.5" stroke-opacity="0.85"/></g></g>
          <g clip-path="url(#eyeclipR-${c.id})"><g class="lidR"><rect x="188" y="86" width="104" height="120" fill="${c.belly}"/><line x1="188" y1="206" x2="292" y2="206" stroke="${c.line}" stroke-width="3.5" stroke-opacity="0.85"/></g></g>
          <g class="browL"><path d="M130,90 Q166,72 200,86" ${stroke(c, c.browWidth)}/></g>
          <g class="browR"><path d="M208,86 Q242,72 278,90" ${stroke(c, c.browWidth)}/></g>
        </g>
        <g class="beak">
          <path class="mouthShape" d="M160,202 C186,230 222,230 248,202 C236,250 172,250 160,202 Z" fill="#463c36" stroke="none"/>
          <g class="jaw"><path d="M168,218 C194,238 216,238 240,218 C232,250 176,250 168,218 Z" ${filled(c, c.beak)}/></g>
          <path d="M156,194 C176,180 232,180 252,194 C244,212 224,220 204,220 C184,220 164,212 156,194 Z" ${filled(c, c.beak)}/>
        </g>
      </g>
    </g>
    <g class="footL"><path d="M122,404 a15,13 0 0 1 27,-7 a13,12 0 0 1 23,0 a15,13 0 0 1 25,9 z" ${filled(c, c.foot, 3)}/></g>
    <g class="footR"><path d="M215,406 a15,13 0 0 1 25,-9 a13,12 0 0 1 23,0 a15,13 0 0 1 27,7 z" ${filled(c, c.foot, 3)}/></g>
  </g>`;
}

// ---------- static side / back views (for the character sheet) ----------
function sideView(c) {
  const npc = c.id === 'npc';
  const brow = npc
    ? `<path d="M236,108 L292,120" ${stroke(c, 13)}/>`
    : `<path d="M238,96 Q262,84 286,94" ${stroke(c, 5)}/>`;
  const beak = npc
    ? `<path d="M290,178 C330,180 360,190 372,200 C360,212 330,216 292,214 Z" ${filled(c, c.beak)}/>
       <path d="M296,214 C330,218 352,216 364,208" ${stroke(c, 3)}/>`
    : `<path d="M292,180 C324,178 348,186 358,196 C346,204 322,206 294,204 Z" ${filled(c, c.beak)}/>
       <path d="M294,208 C318,222 342,220 352,210 C338,232 304,234 292,214 Z" ${filled(c, c.beak)}/>
       <path d="M293,204 C316,212 340,210 354,200 C340,216 310,218 293,208 Z" fill="#463c36" stroke="none"/>`;
  const tuft = npc
    ? `<path d="M212,64 q-20,-16 -36,-16 M232,60 q-10,-22 -26,-28 M252,62 q0,-24 -10,-32" ${stroke(c, 4)}/>`
    : `<path d="M212,58 q-10,-26 -22,-33 M228,54 q-2,-28 6,-38 M244,58 q12,-22 24,-28" ${stroke(c, 4)}/>`;
  return `
  <g class="root">
    <path d="M226,64 C170,68 140,116 138,176 C136,226 106,256 100,312 C94,372 150,406 218,406 C290,406 336,368 330,306 C324,248 302,220 300,170 C298,112 278,62 226,64 Z" ${filled(c, c.body)}/>
    <path d="M226,64 C170,68 140,116 138,176 C136,226 106,256 100,312 C94,372 150,406 218,406 C290,406 336,368 330,306 C324,248 302,220 300,170 C298,112 278,62 226,64 Z" fill="url(#hatch-${c.id})" stroke="none" opacity="0.32"/>
    <path d="M300,236 C322,268 326,330 300,368 C280,394 240,402 218,398 C266,388 296,342 292,290 C290,262 296,246 300,236 Z" ${filled(c, c.belly)}/>
    <path d="M150,220 C128,252 122,304 132,340 C138,358 160,352 170,326 C180,294 176,250 168,222 Z" ${filled(c, c.body)}/>
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
  const tuft = c.id === 'npc'
    ? `<path d="M176,62 q-12,-18 -26,-22 M196,58 q-4,-24 -14,-32 M218,58 q6,-22 16,-28" ${stroke(c, 4)}/>`
    : `<path d="M184,60 q-8,-26 -18,-34 M200,56 q-2,-28 4,-38 M216,60 q10,-24 20,-30" ${stroke(c, 4)}/>`;
  return `
  <g class="root">
    <path d="M200,62 C150,64 122,110 118,166 C115,212 78,246 70,308 C63,372 126,406 200,406 C274,406 337,372 330,308 C322,246 285,212 282,166 C278,110 250,64 200,62 Z" ${filled(c, c.body)}/>
    <path d="M200,62 C150,64 122,110 118,166 C115,212 78,246 70,308 C63,372 126,406 200,406 C274,406 337,372 330,308 C322,246 285,212 282,166 C278,110 250,64 200,62 Z" fill="url(#hatch-${c.id})" stroke="none" opacity="0.4"/>
    ${tuft}
    <path d="M92,220 C68,250 58,300 68,338 C74,354 94,348 104,322 Z" ${filled(c, c.body)}/>
    <path d="M308,220 C332,250 342,300 332,338 C326,354 306,348 296,322 Z" ${filled(c, c.body)}/>
    <path d="M182,368 C190,388 210,388 218,368 C214,394 186,394 182,368 Z" ${filled(c, c.body)}/>
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
    this._origins = {
      body: '200px 404px',
      head: '200px 226px',
      flipperL: config.id === 'npc' ? '88px 220px' : '104px 216px',
      flipperR: config.id === 'npc' ? '312px 220px' : '304px 216px',
      browL: '162px 104px',
      browR: '238px 104px',
      root: '200px 404px',
    };
    for (const k of ['body', 'head', 'flipperL', 'flipperR', 'browL', 'browR', 'root']) {
      this.parts[k].style.transformOrigin = this._origins[k];
    }
    this.parts.mouth.style.transformOrigin = '200px 202px';
    const eyeY = config.id === 'npc' ? 150 : 146;
    this.parts.lidL.style.transformOrigin = `${config.id === 'npc' ? 163 : 166}px ${eyeY}px`;
    this.parts.lidR.style.transformOrigin = `${config.id === 'npc' ? 237 : 240}px ${eyeY}px`;

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
    const skew = this.cfg.id === 'npc' ? 7 : 0;
    const lidRange = this.cfg.id === 'npc' ? 124 : 120;
    p.lidL.style.transform = `translateY(${-lidRange * (1 - lid)}px) rotate(${skew}deg)`;
    p.lidR.style.transform = `translateY(${-lidRange * (1 - lid)}px) rotate(${-skew}deg)`;
    p.browL.style.transform = `translateY(${e.browY + (m.browLift || 0)}px) rotate(${e.browL}deg)`;
    p.browR.style.transform = `translateY(${e.browY + (m.browLift || 0)}px) rotate(${e.browR}deg)`;
    p.pupilL.style.transform = `translateY(${e.pupilY}px) scale(${e.pupil})`;
    p.pupilR.style.transform = `translateY(${e.pupilY}px) scale(${e.pupil})`;
    p.pupilL.style.transformOrigin = this.cfg.id === 'npc' ? '170px 160px' : '173px 150px';
    p.pupilR.style.transformOrigin = this.cfg.id === 'npc' ? '230px 160px' : '233px 150px';
    const open = clamp(this.talking ? Math.max(e.beakOpen, this._talkOpen) : e.beakOpen, 0, 1);
    p.jaw.style.transform = `translateY(${open * (this.cfg.id === 'cap' ? 20 : 12)}px)`;
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
