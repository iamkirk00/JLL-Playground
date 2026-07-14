'use strict';

const video = document.createElement('video');
video.playsInline = true;
video.muted = true;

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const patchCanvas = document.createElement('canvas');
const pctx = patchCanvas.getContext('2d');
const ridgeCanvas = document.createElement('canvas');
const rctx = ridgeCanvas.getContext('2d');

const state = {
  mode: 'moon',            // 'moon' | 'ridge'
  boost: 2.0,
  sizeFrac: 0.14,          // moon patch radius as fraction of min(canvas w,h)
  point: { x: 0.5, y: 0.35 }, // normalized: moon center, or ridge anchor azimuth
  horizon: 0.55,           // normalized y of horizon seam (ridge mode)
  guideUntil: 0,
  compareRaw: false,
  running: false,
};

const $ = (id) => document.getElementById(id);

// ---------- camera ----------

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 4096 },
      height: { ideal: 2160 },
    },
  });
  video.srcObject = stream;
  await video.play();
  state.running = true;
  requestAnimationFrame(tick);
}

// ---------- geometry: canvas <-> video "cover" mapping ----------

function coverMap(cw, ch) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = Math.max(cw / vw, ch / vh);
  return { scale, sx: (vw - cw / scale) / 2, sy: (vh - ch / scale) / 2, vw, vh };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- rendering ----------

function drawScene(g2d, cw, ch, showGuides) {
  const m = coverMap(cw, ch);
  g2d.drawImage(video, m.sx, m.sy, cw / m.scale, ch / m.scale, 0, 0, cw, ch);
  if (state.compareRaw) return;

  if (state.mode === 'moon') drawMoon(g2d, cw, ch, m, showGuides);
  else drawRidge(g2d, cw, ch, m, showGuides);
}

function drawMoon(g2d, cw, ch, m, showGuides) {
  const R = state.sizeFrac * Math.min(cw, ch);
  const g = state.boost;
  const cx = state.point.x * cw, cy = state.point.y * ch;

  // source half-size in video pixels for a g× magnified patch
  const rv = R / (m.scale * g);
  let vcx = m.sx + cx / m.scale;
  let vcy = m.sy + cy / m.scale;
  vcx = clamp(vcx, rv, m.vw - rv);
  vcy = clamp(vcy, rv, m.vh - rv);

  const s = Math.ceil(2 * R);
  if (patchCanvas.width !== s) { patchCanvas.width = s; patchCanvas.height = s; }
  pctx.clearRect(0, 0, s, s);
  pctx.drawImage(video, vcx - rv, vcy - rv, 2 * rv, 2 * rv, 0, 0, s, s);

  // feathered radial mask: opaque core, transparent rim
  pctx.globalCompositeOperation = 'destination-in';
  const grad = pctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.72, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  pctx.fillStyle = grad;
  pctx.fillRect(0, 0, s, s);
  pctx.globalCompositeOperation = 'source-over';

  g2d.drawImage(patchCanvas, cx - R, cy - R, 2 * R, 2 * R);

  if (showGuides && performance.now() < state.guideUntil) {
    g2d.save();
    g2d.strokeStyle = 'rgba(255,255,255,0.8)';
    g2d.setLineDash([6, 6]);
    g2d.lineWidth = 1.5;
    g2d.beginPath();
    g2d.arc(cx, cy, R, 0, Math.PI * 2);
    g2d.stroke();
    g2d.restore();
  }
}

function drawRidge(g2d, cw, ch, m, showGuides) {
  const hy = state.horizon * ch;
  if (hy < 8) return;
  const g = state.boost;
  const ax = state.point.x * cw;

  // magnify everything above the horizon, anchored at (ax, hy) so the seam
  // stays continuous where the terrain meets the ground line
  const srcW = cw / (m.scale * g);
  const srcH = hy / (m.scale * g);
  const vax = m.sx + ax / m.scale;
  const vay = m.sy + hy / m.scale;
  const srcX = clamp(vax - (ax / cw) * srcW, 0, m.vw - srcW);
  const srcY = clamp(vay - srcH, 0, m.vh - srcH);

  const w = Math.ceil(cw), h = Math.ceil(hy);
  if (ridgeCanvas.width !== w || ridgeCanvas.height !== h) {
    ridgeCanvas.width = w; ridgeCanvas.height = h;
  }
  rctx.clearRect(0, 0, w, h);
  rctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, w, h);

  // crossfade the last strip above the seam into the base frame
  const feather = Math.max(12, h * 0.06);
  rctx.globalCompositeOperation = 'destination-in';
  const grad = rctx.createLinearGradient(0, h - feather, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  rctx.fillStyle = 'rgba(0,0,0,1)';
  rctx.fillRect(0, 0, w, h - feather);
  rctx.fillStyle = grad;
  rctx.fillRect(0, h - feather, w, feather);
  rctx.globalCompositeOperation = 'source-over';

  g2d.drawImage(ridgeCanvas, 0, 0, w, h);

  if (showGuides) {
    g2d.save();
    g2d.strokeStyle = 'rgba(255,255,255,0.55)';
    g2d.setLineDash([10, 8]);
    g2d.lineWidth = 1.5;
    g2d.beginPath();
    g2d.moveTo(0, hy);
    g2d.lineTo(cw, hy);
    g2d.stroke();
    g2d.setLineDash([]);
    g2d.fillStyle = 'rgba(255,255,255,0.85)';
    g2d.beginPath();
    g2d.moveTo(ax, hy - 10); g2d.lineTo(ax - 6, hy - 2); g2d.lineTo(ax + 6, hy - 2);
    g2d.closePath(); g2d.fill();
    g2d.restore();
  }
}

function tick() {
  if (!state.running) return;
  if (video.readyState >= 2) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(canvas.clientWidth * dpr);
    const ch = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw; canvas.height = ch;
    }
    drawScene(ctx, cw, ch, true);
  }
  requestAnimationFrame(tick);
}

// ---------- capture ----------

function capture() {
  const m = coverMap(canvas.width, canvas.height);
  // full-resolution crop of exactly what the preview shows
  const cw = Math.round(canvas.width / m.scale);
  const ch = Math.round(canvas.height / m.scale);
  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  drawScene(out.getContext('2d'), cw, ch, false);

  out.toBlob((blob) => {
    if (!blob) { toast('Capture failed'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `perception-lens-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast(`Saved ${cw}×${ch} · boost ${state.boost.toFixed(2)}×`);
  }, 'image/jpeg', 0.92);

  const flash = $('flash');
  flash.style.transition = 'none';
  flash.style.opacity = '0.9';
  requestAnimationFrame(() => {
    flash.style.transition = 'opacity .35s ease-out';
    flash.style.opacity = '0';
  });
}

// ---------- UI ----------

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 2600);
}

function setMode(mode) {
  state.mode = mode;
  $('modeMoon').classList.toggle('active', mode === 'moon');
  $('modeRidge').classList.toggle('active', mode === 'ridge');
  $('sizeRow').style.display = mode === 'moon' ? 'flex' : 'none';
  $('hint').textContent = mode === 'moon'
    ? 'Tap the moon (or any distant subject) to place the lens'
    : 'Drag to set the horizon line at the base of the mountains';
  state.guideUntil = performance.now() + 2000;
}

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: clamp((e.clientX - r.left) / r.width, 0, 1),
    y: clamp((e.clientY - r.top) / r.height, 0, 1),
  };
}

let dragging = false;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  applyPointer(e);
});
canvas.addEventListener('pointermove', (e) => { if (dragging) applyPointer(e); });
canvas.addEventListener('pointerup', () => { dragging = false; });

function applyPointer(e) {
  const p = pointerPos(e);
  if (state.mode === 'moon') {
    state.point = p;
  } else {
    state.point.x = p.x;
    state.horizon = p.y;
  }
  state.guideUntil = performance.now() + 1500;
}

$('boost').addEventListener('input', (e) => {
  state.boost = parseFloat(e.target.value);
  $('boostBadge').textContent = `${state.boost.toFixed(2).replace(/0$/, '')}×`;
});
$('size').addEventListener('input', (e) => {
  state.sizeFrac = parseFloat(e.target.value);
  state.guideUntil = performance.now() + 1200;
});
$('modeMoon').addEventListener('click', () => setMode('moon'));
$('modeRidge').addEventListener('click', () => setMode('ridge'));
$('shutter').addEventListener('click', capture);

const rawBtn = $('rawBtn');
rawBtn.addEventListener('pointerdown', () => { state.compareRaw = true; });
rawBtn.addEventListener('pointerup', () => { state.compareRaw = false; });
rawBtn.addEventListener('pointerleave', () => { state.compareRaw = false; });

$('startBtn').addEventListener('click', async () => {
  try {
    await startCamera();
    $('startOverlay').style.display = 'none';
    state.guideUntil = performance.now() + 3000;
  } catch (err) {
    $('startOverlay').style.display = 'none';
    $('errOverlay').style.display = 'flex';
    $('errMsg').textContent =
      (location.protocol !== 'https:' && location.hostname !== 'localhost')
        ? 'Camera access requires HTTPS (or localhost). Deploy this page to a secure host and try again.'
        : `${err.name}: ${err.message}`;
  }
});
