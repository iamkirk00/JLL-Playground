// penguin.js — procedural toon penguins with expression rig + animation state machine
import * as THREE from 'three';

// ---------- shared toon resources ----------
let _gradientMap = null;
function gradientMap() {
  if (_gradientMap) return _gradientMap;
  const data = new Uint8Array([90, 160, 220, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  _gradientMap = tex;
  return tex;
}

function toonMat(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
}

// Cartoon outline: inverted-hull child mesh.
function outline(mesh, scale = 1.045, color = 0x33313e) {
  const o = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  );
  o.scale.setScalar(scale);
  o.raycast = () => {};
  mesh.add(o);
  return mesh;
}

const SPH = (r, w = 24, h = 18) => new THREE.SphereGeometry(r, w, h);

// ---------- character configs ----------
export const PENGUIN_CONFIGS = {
  npc: {
    id: 'npc',
    bodyColor: 0x59606b,
    bellyColor: 0xf3ecdb,
    beakColor: 0xc9924e,
    footColor: 0xc9924e,
    facePatch: false,
    tuft: 'fringe',
    posture: 0.10,           // forward slouch (rad)
    defaultExpression: 'unimpressed',
    browThickness: 0.085,
    browLength: 0.34,
    beakWidth: 1.35,
  },
  cap: {
    id: 'cap',
    bodyColor: 0x5f7080,
    bellyColor: 0xf8f1e1,
    beakColor: 0xe8a558,
    footColor: 0xe8a558,
    facePatch: true,
    tuft: 'spiky',
    posture: -0.06,          // chest out
    defaultExpression: 'bright',
    browThickness: 0.028,
    browLength: 0.26,
    beakWidth: 1.0,
  },
};

// ---------- expression presets ----------
// browL/browR: z-rotation. For LEFT brow (character's right on screen, x<0):
// positive z lifts the OUTER end. Inner-down "angry" => browL positive, browR negative.
// Empirical: browL positive z = raised/soft look; negative = angry (mirrored for browR).
export const EXPRESSIONS = {
  neutral:     { browL: 0.08, browR: -0.08, browY: 0,     lidTop: 0.08, beakOpen: 0.05, headTiltZ: 0,     headTiltX: 0,     pupil: 1.0, pupilY: 0 },
  bright:      { browL: 0.3,  browR: -0.3,  browY: 0.05,  lidTop: 0.0,  beakOpen: 0.35, headTiltZ: 0,     headTiltX: -0.04, pupil: 1.1, pupilY: 0.01 },
  unimpressed: { browL: -0.28, browR: 0.28, browY: -0.06, lidTop: 0.5,  beakOpen: 0.0,  headTiltZ: 0,     headTiltX: 0.03,  pupil: 0.9, pupilY: 0 },
  happy:       { browL: 0.25, browR: -0.25, browY: 0.04,  lidTop: 0.15, beakOpen: 0.25, headTiltZ: 0.05,  headTiltX: -0.03, pupil: 1.05, pupilY: 0 },
  laugh:       { browL: 0.3,  browR: -0.3,  browY: 0.07,  lidTop: 0.8,  beakOpen: 0.9,  headTiltZ: 0,     headTiltX: -0.22, pupil: 1.0, pupilY: 0 },
  think:       { browL: 0.4,  browR: 0.15,  browY: 0.02,  lidTop: 0.3,  beakOpen: 0.0,  headTiltZ: 0.14,  headTiltX: -0.06, pupil: 0.85, pupilY: 0.05 },
  surprised:   { browL: 0.35, browR: -0.35, browY: 0.1,   lidTop: 0.0,  beakOpen: 0.5,  headTiltZ: 0,     headTiltX: -0.08, pupil: 0.7, pupilY: 0 },
  annoyed:     { browL: -0.55, browR: 0.55, browY: -0.09, lidTop: 0.5,  beakOpen: 0.0,  headTiltZ: -0.06, headTiltX: 0.05,  pupil: 0.85, pupilY: 0 },
  sad:         { browL: 0.5,  browR: -0.5,  browY: 0.03,  lidTop: 0.45, beakOpen: 0.0,  headTiltZ: 0.04,  headTiltX: 0.12,  pupil: 0.95, pupilY: -0.03 },
  determined:  { browL: -0.35, browR: 0.35, browY: -0.04, lidTop: 0.1,  beakOpen: 0.1,  headTiltZ: 0,     headTiltX: 0.02,  pupil: 1.0, pupilY: 0 },
  skeptical:   { browL: 0.45, browR: -0.05, browY: 0,     lidTop: 0.4,  beakOpen: 0.0,  headTiltZ: 0.1,   headTiltX: 0.02,  pupil: 0.9, pupilY: 0.02 },
  excited:     { browL: 0.35, browR: -0.35, browY: 0.1,   lidTop: 0.0,  beakOpen: 0.7,  headTiltZ: 0,     headTiltX: -0.1,  pupil: 1.15, pupilY: 0.02 },
};

// Map emote tags (from AI/scripts) to { anim, expression }
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

// ---------- pose presets for the character sheet ----------
// Static joint targets: flipperL/R (x,z rot), headYaw, headTiltX/Z, bodyLean, feet
// fL/fR = [rotX, rotZ] applied directly. Left flipper raised outward = z negative,
// right flipper raised outward = z positive.
export const POSES = {
  stand:    { fL: [0, -0.22],  fR: [0, 0.22],   lean: 0,     expr: null },
  wave:     { fL: [0, -0.22],  fR: [0.3, 2.7],  lean: -0.03, expr: 'happy' },
  openArms: { fL: [-0.5, -2.1],fR: [-0.5, 2.1], lean: -0.08, expr: 'excited' },
  think:    { fL: [0, -0.22],  fR: [-1.9, -0.25],lean: 0.05, expr: 'think' },
  shrug:    { fL: [-0.4, -1.2],fR: [-0.4, 1.2], lean: 0.02,  expr: 'skeptical' },
  point:    { fL: [0, -0.22],  fR: [-1.5, 1.4], lean: -0.05, expr: 'determined' },
  stride:   { fL: [0.8, -0.35],fR: [-0.8, 0.35],lean: 0.06,  stride: 0.5, expr: 'happy' },
  slump:    { fL: [0.15, -0.12],fR: [0.15, 0.12],lean: 0.16, expr: 'unimpressed' },
};

const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// ============================================================
export class Penguin {
  constructor(config) {
    this.cfg = config;
    this.root = new THREE.Group();
    this.root.name = 'penguin-' + config.id;
    this._build();

    this.state = 'idle';
    this.stateTime = 0;
    this.stateDur = Infinity;
    this.talking = false;
    this.talkPhase = Math.random() * 10;
    this.blinkTimer = 1.5 + Math.random() * 3;
    this.blink = 0;
    this.walk = null; // { toX, toZ, speed }
    this.exprCurrent = { ...EXPRESSIONS[config.defaultExpression] };
    this.exprTarget = { ...EXPRESSIONS[config.defaultExpression] };
    this.baseExpression = config.defaultExpression;
    this.exprHoldTimer = 0;
    this._applyExpression(this.exprCurrent);
  }

  // ------------------------------------------------ build
  _build() {
    const c = this.cfg;
    const bodyCol = toonMat(c.bodyColor);
    const bellyCol = toonMat(c.bellyColor);
    const beakCol = toonMat(c.beakColor);
    const footCol = toonMat(c.footColor);

    this.body = new THREE.Group();
    this.body.position.y = 1.06;
    this.root.add(this.body);

    // torso
    const torso = new THREE.Mesh(SPH(1), bodyCol);
    torso.scale.set(1, 1.18, 0.95);
    torso.castShadow = true;
    outline(torso);
    this.body.add(torso);

    // belly
    const belly = new THREE.Mesh(SPH(0.93), bellyCol);
    belly.scale.set(0.8, 1.02, 0.62);
    belly.position.set(0, -0.08, 0.4);
    this.body.add(belly);

    // tail
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 12), bodyCol);
    tail.position.set(0, -0.55, -0.85);
    tail.rotation.x = 1.9;
    outline(tail);
    this.body.add(tail);

    // ---- head
    this.head = new THREE.Group();
    this.head.position.set(0, 1.0, 0.08);
    this.body.add(this.head);

    const skull = new THREE.Mesh(SPH(0.8), bodyCol);
    skull.scale.set(1, 0.96, 0.92);
    skull.castShadow = true;
    outline(skull);
    this.head.add(skull);

    if (c.facePatch) {
      const patch = new THREE.Mesh(SPH(0.72), bellyCol);
      patch.scale.set(0.88, 0.8, 0.55);
      patch.position.set(0, -0.12, 0.36);
      this.head.add(patch);
    }

    // tuft
    const tuftG = new THREE.Group();
    tuftG.position.set(0, c.tuft === 'spiky' ? 0.68 : 0.56, c.tuft === 'spiky' ? 0.1 : 0.38);
    this.head.add(tuftG);
    const tuftSpecs = c.tuft === 'spiky'
      ? [[-0.14, 0.16, -0.45], [0.02, 0.24, 0.1], [0.16, 0.14, 0.5]]
      : [[-0.17, 0.06, 1.15], [0, 0.1, 1.25], [0.17, 0.05, 1.35]]; // fringe flops over forehead
    for (const [x, y, rx] of tuftSpecs) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.42, 8), bodyCol);
      spike.position.set(x, y, 0);
      spike.rotation.x = rx;
      spike.rotation.z = -x * 1.4;
      outline(spike, 1.12);
      tuftG.add(spike);
    }

    // ---- eyes
    this.eyes = {};
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(side * 0.3, 0.1, 0.62);
      this.head.add(g);

      const white = new THREE.Mesh(SPH(0.185), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      white.scale.set(1, 1.25, 0.7);
      g.add(white);
      const rim = new THREE.Mesh(SPH(0.185), new THREE.MeshBasicMaterial({ color: 0x33313e, side: THREE.BackSide }));
      rim.scale.set(1.1, 1.32, 0.78);
      g.add(rim);

      const pupil = new THREE.Mesh(SPH(0.085, 12, 10), new THREE.MeshBasicMaterial({ color: 0x1c1b22 }));
      pupil.position.set(0, 0.01, 0.135);
      g.add(pupil);
      const glint = new THREE.Mesh(SPH(0.028, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      glint.position.set(0.03, 0.05, 0.2);
      g.add(glint);

      // eyelid: skin-colored hemisphere that rotates down over the eye
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        toonMat(c.bodyColor)
      );
      lid.scale.set(1.05, 1.28, 0.75);
      g.add(lid);

      // brow
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(c.browThickness, c.browLength || 0.3, 4, 8), toonMat(0x33313e));
      brow.rotation.z = Math.PI / 2;
      const browPivot = new THREE.Group();
      browPivot.position.set(0, 0.26, 0.04);
      browPivot.add(brow);
      g.add(browPivot);

      this.eyes[side === -1 ? 'L' : 'R'] = { g, pupil, lid, browPivot };
    }

    // ---- beak
    this.beak = new THREE.Group();
    this.beak.position.set(0, -0.26, 0.64);
    this.head.add(this.beak);

    const beakTop = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.64, 14), beakCol);
    beakTop.rotation.x = Math.PI / 2 + 0.12;
    beakTop.scale.set(c.beakWidth, 1, 0.55);
    beakTop.position.set(0, 0.035, 0.22);
    outline(beakTop, 1.07);
    this.beak.add(beakTop);

    this.jaw = new THREE.Group(); // pivot at beak root
    const beakBot = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.52, 14), beakCol);
    beakBot.rotation.x = Math.PI / 2 - 0.1;
    beakBot.scale.set(c.beakWidth * 0.94, 1, 0.45);
    beakBot.position.set(0, -0.055, 0.17);
    outline(beakBot, 1.07);
    this.jaw.add(beakBot);
    this.beak.add(this.jaw);

    // ---- flippers
    this.flippers = {};
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.92, 0.42, 0);
      this.body.add(pivot);
      const fl = new THREE.Mesh(SPH(0.5), bodyCol);
      fl.scale.set(0.34, 1.0, 0.55);
      fl.position.y = -0.42;
      fl.castShadow = true;
      outline(fl);
      pivot.add(fl);
      pivot.rotation.z = side * 0.22;
      this.flippers[side === -1 ? 'L' : 'R'] = pivot;
    }

    // ---- feet
    this.feet = {};
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(SPH(0.24, 16, 12), footCol);
      foot.scale.set(1.25, 0.45, 1.7);
      foot.position.set(side * 0.42, 0.1, 0.28);
      foot.rotation.y = side * 0.22;
      foot.castShadow = true;
      outline(foot, 1.06);
      this.root.add(foot);
      this.feet[side === -1 ? 'L' : 'R'] = foot;
    }

    this.body.rotation.x = c.posture;
  }

  // ------------------------------------------------ expression
  setExpression(name, holdSeconds = 0) {
    const e = EXPRESSIONS[name];
    if (!e) return;
    this.exprTarget = { ...e };
    if (holdSeconds > 0) this.exprHoldTimer = holdSeconds;
    else this.baseExpression = name;
  }

  _applyExpression(e) {
    const blink = this.blink;
    const lid = Math.max(e.lidTop, blink);
    for (const k of ['L', 'R']) {
      const eye = this.eyes[k];
      eye.lid.rotation.x = lerp(-1.35, -0.15, clamp(lid, 0, 1));
      eye.pupil.scale.setScalar(e.pupil);
      eye.pupil.position.y = 0.01 + e.pupilY;
      eye.browPivot.position.y = 0.26 + e.browY;
      eye.browPivot.rotation.z = k === 'L' ? e.browL : e.browR;
    }
    const open = this.talking ? Math.max(e.beakOpen, this._talkOpen) : e.beakOpen;
    this.jaw.rotation.x = lerp(0.02, 0.55, clamp(open, 0, 1));
    this._exprHead = { z: e.headTiltZ, x: e.headTiltX };
  }

  // ------------------------------------------------ states
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

  walkTo(x, z, speed = 1.6) {
    this.walk = { toX: x, toZ: z, speed };
    this.state = 'waddle';
    this.stateTime = 0;
    this.stateDur = Infinity;
  }

  faceToward(x, z) {
    const dx = x - this.root.position.x;
    const dz = z - this.root.position.z;
    this.root.rotation.y = Math.atan2(dx, dz);
  }

  // Freeze into a static pose (for the character sheet).
  setPose(name, exprOverride = null) {
    const p = POSES[name] || POSES.stand;
    this.flippers.L.rotation.set(p.fL[0], 0, p.fL[1]);
    this.flippers.R.rotation.set(p.fR[0], 0, p.fR[1]);
    this.body.rotation.x = this.cfg.posture + p.lean;
    this.body.rotation.z = 0;
    this.body.position.y = 1.06;
    this.head.rotation.set(0, 0, 0);
    if (p.stride) {
      this.feet.L.position.z = 0.28 + p.stride * 0.5;
      this.feet.R.position.z = 0.28 - p.stride * 0.5;
      this.body.rotation.z = 0.08;
    } else {
      this.feet.L.position.z = 0.28;
      this.feet.R.position.z = 0.28;
      this.feet.L.position.y = 0.1;
      this.feet.R.position.y = 0.1;
    }
    const expr = exprOverride || p.expr || this.cfg.defaultExpression;
    this.blink = 0;
    this.talking = false;
    this.exprCurrent = { ...EXPRESSIONS[expr] };
    this._talkOpen = 0;
    this._applyExpression(this.exprCurrent);
    this.head.rotation.z = this.exprCurrent.headTiltZ;
    this.head.rotation.x = this.exprCurrent.headTiltX;
  }

  // ------------------------------------------------ per-frame update
  update(dt, t) {
    this.stateTime += dt;
    const st = this.stateTime;
    const phase = this.talkPhase;

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

    // talk mouth
    this._talkOpen = this.talking
      ? 0.25 + 0.35 * Math.abs(Math.sin(t * 9 + phase)) + 0.15 * Math.sin(t * 23 + phase)
      : 0;

    this._applyExpression(this.exprCurrent);

    // ---- base idle motion (always layered)
    const breathe = Math.sin(t * 1.7 + phase) * 0.015;
    let bodyY = 1.06 + breathe;
    let bodyRotX = this.cfg.posture;
    let bodyRotZ = Math.sin(t * 0.8 + phase) * 0.012;
    let headYaw = Math.sin(t * 0.5 + phase) * 0.07;
    let headTiltX = this._exprHead.x + Math.sin(t * 1.1 + phase) * 0.02;
    let headTiltZ = this._exprHead.z;
    let fL = { x: 0, z: -0.22 + Math.sin(t * 1.4 + phase) * 0.04 };
    let fR = { x: 0, z: 0.22 - Math.sin(t * 1.4 + phase + 1) * 0.04 };
    let footL = { y: 0.1, z: 0.28 };
    let footR = { y: 0.1, z: 0.28 };

    const s = this.state;
    if (s === 'talk' || this.talking) {
      headTiltX += Math.sin(t * 3.1 + phase) * 0.04;
      headYaw += Math.sin(t * 2.2 + phase) * 0.05;
      if (this.cfg.id === 'cap') { // expressive gestures
        fR.z = 0.22 + (0.5 + 0.45 * Math.sin(t * 2.6 + phase)) * 1.2;
        fR.x = -0.3 + Math.sin(t * 3.3 + phase) * 0.25;
        fL.z = -0.22 - Math.max(0, Math.sin(t * 1.9 + phase + 2)) * 0.7;
      } else { // NPC barely moves. It's a whole thing.
        fR.z = 0.22 + Math.max(0, Math.sin(t * 1.5 + phase)) * 0.25;
      }
    } else if (s === 'wave') {
      const k = Math.min(1, st * 4);
      fR.z = 0.22 + k * 2.5;
      fR.x = Math.sin(st * 10) * 0.45 * k;
      headTiltZ += 0.08 * k;
    } else if (s === 'laugh') {
      bodyY += Math.abs(Math.sin(st * 9)) * 0.09;
      bodyRotX -= 0.12;
      headTiltX -= 0.15;
      fL.z = -0.22 - Math.abs(Math.sin(st * 9)) * 0.35;
      fR.z = 0.22 + Math.abs(Math.sin(st * 9 + 0.3)) * 0.35;
    } else if (s === 'think') {
      const k = Math.min(1, st * 3);
      fR.z = 0.22 - k * 0.45;
      fR.x = -k * 1.9;
      headTiltZ += 0.12 * k;
      headYaw += 0.15 * k;
    } else if (s === 'shrug') {
      const k = Math.min(1, st * 4) * (this.stateDur - st > 0.4 ? 1 : Math.max(0, (this.stateDur - st) / 0.4));
      fL.z = -0.22 - k * 0.95;
      fL.x = -k * 0.4;
      fR.z = 0.22 + k * 0.95;
      fR.x = -k * 0.4;
      bodyY += k * 0.04;
      headTiltZ += k * 0.1;
    } else if (s === 'excited') {
      const hop = Math.abs(Math.sin(st * 7));
      bodyY += hop * 0.16;
      this.root.position.y = hop * 0.12;
      fL.z = -0.22 - 2.2 - Math.sin(st * 7) * 0.3;
      fR.z = 0.22 + 2.2 + Math.sin(st * 7) * 0.3;
      if (this.stateDur - st < 0.3) this.root.position.y = 0;
    } else if (s === 'nod') {
      headTiltX += Math.sin(st * 8) * 0.18;
    } else if (s === 'waddle' && this.walk) {
      const { toX, toZ, speed } = this.walk;
      const dx = toX - this.root.position.x;
      const dz = toZ - this.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.05) {
        this.walk = null;
        this.state = 'idle';
      } else {
        const step = Math.min(dist, speed * dt);
        this.root.position.x += (dx / dist) * step;
        this.root.position.z += (dz / dist) * step;
        this.root.rotation.y = Math.atan2(dx, dz);
        const w = t * 10;
        bodyRotZ = Math.sin(w) * 0.14;
        bodyY += Math.abs(Math.sin(w)) * 0.05;
        footL.y = 0.1 + Math.max(0, Math.sin(w)) * 0.14;
        footR.y = 0.1 + Math.max(0, -Math.sin(w)) * 0.14;
        footL.z = 0.28 + Math.sin(w) * 0.12;
        footR.z = 0.28 - Math.sin(w) * 0.12;
        headYaw = 0;
      }
    }

    // state expiry
    if (st > this.stateDur && s !== 'waddle') {
      this.state = this.talking ? 'talk' : 'idle';
      this.stateTime = 0;
      this.stateDur = Infinity;
      if (this.cfg.id && s === 'excited') this.root.position.y = 0;
    }

    // apply
    this.body.position.y = bodyY;
    this.body.rotation.x = bodyRotX;
    this.body.rotation.z = bodyRotZ;
    this.head.rotation.y = headYaw;
    this.head.rotation.x = headTiltX;
    this.head.rotation.z = headTiltZ;
    this.flippers.L.rotation.x = lerp(this.flippers.L.rotation.x, fL.x, Math.min(1, dt * 8));
    this.flippers.L.rotation.z = lerp(this.flippers.L.rotation.z, fL.z, Math.min(1, dt * 8));
    this.flippers.R.rotation.x = lerp(this.flippers.R.rotation.x, fR.x, Math.min(1, dt * 8));
    this.flippers.R.rotation.z = lerp(this.flippers.R.rotation.z, fR.z, Math.min(1, dt * 8));
    this.feet.L.position.y = footL.y;
    this.feet.L.position.z = footL.z;
    this.feet.R.position.y = footR.y;
    this.feet.R.position.z = footR.z;
  }
}

// ---------- scenery ----------
export function buildEnvironment(scene) {
  scene.background = new THREE.Color(0xcfe6f2);
  scene.fog = new THREE.Fog(0xcfe6f2, 18, 42);

  const snow = new THREE.Mesh(
    new THREE.CircleGeometry(26, 48),
    new THREE.MeshToonMaterial({ color: 0xf2f6f8, gradientMap: gradientMap() })
  );
  snow.rotation.x = -Math.PI / 2;
  snow.receiveShadow = true;
  scene.add(snow);

  // ice mounds
  const moundMat = toonMat(0xdfeef5);
  const spots = [[-6, -5, 1.6], [7, -6, 2.2], [-8, -9, 2.8], [9, -10, 3.4], [3, -12, 4]];
  for (const [x, z, r] of spots) {
    const m = new THREE.Mesh(SPH(r, 16, 12), moundMat);
    m.position.set(x, -r * 0.55, z);
    m.scale.y = 0.6;
    m.receiveShadow = true;
    scene.add(m);
  }

  const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x9fb4c4, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sun.position.set(6, 10, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdce9f5, 0.6);
  fill.position.set(-5, 4, -6);
  scene.add(fill);
}
