// sheet.js — renders turnaround views, poses, and expression close-ups
// into a downloadable model-sheet PNG (plus per-cell transparent PNGs).
import * as THREE from 'three';
import { Penguin, PENGUIN_CONFIGS } from './penguin.js';

const VIEWS = [
  { label: 'FRONT', yaw: 0 },
  { label: '3/4', yaw: Math.PI * 0.22 },
  { label: 'SIDE', yaw: Math.PI * 0.5 },
  { label: 'BACK', yaw: Math.PI },
];
const POSE_ROW = [
  { label: 'STAND', pose: 'stand' },
  { label: 'WAVE', pose: 'wave' },
  { label: 'OPEN ARMS', pose: 'openArms' },
  { label: 'THINKING', pose: 'think' },
  { label: 'SHRUG', pose: 'shrug' },
  { label: 'POINT', pose: 'point' },
  { label: 'STRIDE', pose: 'stride' },
  { label: 'SLUMP', pose: 'slump' },
];
const EXPR_ROW = [
  { label: 'NEUTRAL', expr: 'neutral' },
  { label: 'BRIGHT', expr: 'bright' },
  { label: 'HAPPY', expr: 'happy' },
  { label: 'LAUGH', expr: 'laugh' },
  { label: 'THINKING', expr: 'think' },
  { label: 'SURPRISED', expr: 'surprised' },
  { label: 'UNIMPRESSED', expr: 'unimpressed' },
  { label: 'DETERMINED', expr: 'determined' },
];

let _rig = null;
function rig() {
  if (_rig) return _rig;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(512, 512);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c6d4, 1.5));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdce9f5, 0.7);
  fill.position.set(-5, 3, -4);
  scene.add(fill);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  _rig = { renderer, scene, camera, penguins: {} };
  return _rig;
}

function getPenguin(charId) {
  const r = rig();
  if (!r.penguins[charId]) {
    const p = new Penguin(PENGUIN_CONFIGS[charId]);
    r.penguins[charId] = p;
  }
  return r.penguins[charId];
}

// Render one cell; returns the renderer's canvas (copy immediately).
function renderCell(charId, { pose = 'stand', expr = null, yaw = 0, framing = 'full' }) {
  const r = rig();
  for (const id in r.penguins) r.scene.remove(r.penguins[id].root);
  const p = getPenguin(charId);
  r.scene.add(p.root);
  p.root.position.set(0, 0, 0);
  p.root.rotation.set(0, yaw, 0);
  p.setPose(pose, expr);

  if (framing === 'bust') {
    r.camera.position.set(0, 2.35, 3.1);
    r.camera.lookAt(0, 2.15, 0);
  } else {
    r.camera.position.set(0, 1.55, 6.4);
    r.camera.lookAt(0, 1.35, 0);
  }
  r.renderer.render(r.scene, r.camera);
  return r.renderer.domElement;
}

// ---------- full sheet ----------
export function generateSheet(charId, charData) {
  const CELL = 300, PAD = 26, LABEL_H = 34, TITLE_H = 110, ROW_GAP = 40;
  const cols = 8;
  const W = PAD * 2 + CELL * cols;
  const rows = [
    { title: 'TURNAROUND', items: VIEWS.map((v) => ({ label: v.label, opts: { pose: 'stand', yaw: v.yaw } })) },
    { title: 'POSES', items: POSE_ROW.map((p) => ({ label: p.label, opts: { pose: p.pose, yaw: Math.PI * 0.06 } })) },
    { title: 'EXPRESSIONS', items: EXPR_ROW.map((e) => ({ label: e.label, opts: { pose: 'stand', expr: e.expr, framing: 'bust' } })) },
  ];
  const H = TITLE_H + rows.length * (CELL + LABEL_H + ROW_GAP) + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // paper background
  ctx.fillStyle = '#f6f2e9';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#d8d0bc';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  // title
  ctx.fillStyle = '#2b3040';
  ctx.font = '700 52px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(`${charData.name} — CHARACTER SHEET`, PAD + 6, 68);
  ctx.font = 'italic 24px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillStyle = '#5b6478';
  ctx.fillText(charData.tagline, PAD + 8, 98);

  const cellMap = []; // for click-to-download
  let y = TITLE_H;
  for (const row of rows) {
    ctx.fillStyle = '#5b6478';
    ctx.font = '700 20px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(row.title, PAD + 4, y + 14);
    const rowY = y + 26;
    const n = row.items.length;
    const rowW = n * CELL;
    const startX = (W - rowW) / 2;
    row.items.forEach((item, i) => {
      const x = startX + i * CELL;
      const src = renderCell(charId, item.opts);
      ctx.drawImage(src, x + 8, rowY, CELL - 16, CELL - 16);
      ctx.fillStyle = '#2b3040';
      ctx.font = '600 18px "Avenir Next", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + CELL / 2, rowY + CELL + 4);
      ctx.textAlign = 'left';
      cellMap.push({ x: x + 8, y: rowY, w: CELL - 16, h: CELL - 16, charId, label: item.label, opts: item.opts });
    });
    y += CELL + LABEL_H + ROW_GAP;
  }

  ctx.fillStyle = '#9aa2b1';
  ctx.font = '16px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText('The Rookery — NPC & CAP', PAD + 6, H - 24);
  return { canvas, cellMap };
}

// High-res single cell with transparent background.
export function renderSingle(charId, opts, size = 1024) {
  const r = rig();
  r.renderer.setSize(size, size);
  const src = renderCell(charId, opts);
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  out.getContext('2d').drawImage(src, 0, 0);
  r.renderer.setSize(512, 512);
  return out;
}

export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}
