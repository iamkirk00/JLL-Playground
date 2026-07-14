# Perception Lens 🌄🌕

**Capture landscapes the way your eye actually sees them.**

A mobile photography app that fixes the most famous disappointment in casual
photography: the huge moon, the towering mountain range, the dramatic ridge line
that looks *majestic* in person — and tiny and flat in the photo. Perception Lens
applies a real-time, depth-aware "perception filter" so the live preview (and the
captured image) matches what your brain perceived, not what the raw optics recorded.

> **Status:** Reference repo + working web prototype. The prototype in
> [`prototype/`](prototype/) runs in a phone browser today, gives a live preview
> of the effect, and saves composited photos. Native apps are the roadmap
> (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

---

## Why photos "shrink" the moon (the problem, precisely)

Two separate things conspire against you:

1. **Optics.** A phone's main camera is very wide (~24 mm equivalent, ~70–80°
   horizontal field of view). The moon subtends only ~0.52° of arc, so it lands on
   roughly **0.7–1% of the frame width** — a bright dot. Your eye's "attention view"
   behaves more like a 40–85 mm lens; a horizon moon *feels* like it fills far more
   of the scene. Mountains suffer the same way: wide lenses exaggerate the size of
   near foreground and diminish everything distant.

2. **Perception.** The *moon illusion*: a moon near the horizon is perceived
   ~1.3–2× larger than the same moon overhead, because the brain scales apparent
   size using distance cues from the terrain. The camera has no brain, so it
   records the bare angular size. The photo is "correct" — and completely wrong
   about the experience.

The classic photographer's fix is a long telephoto shot from far away
("compression"). Perception Lens automates the *perceptual result* of that
technique: **selectively magnify distant subjects relative to the foreground**,
smoothly, in real time.

The math and the perceptual gain model live in
[docs/PERCEPTION-MODEL.md](docs/PERCEPTION-MODEL.md).

## Is this practical? — Assessment

**Yes, with a layered approach.** The honest summary:

| Layer | What it does | Feasibility |
|---|---|---|
| **1. Geometric composite** (this prototype) | User (or a detector) marks the distant subject; the app magnifies it with a feathered, anchored blend. Pure image-space math — no ML needed. | ✅ Works today, runs at 60 fps in a browser canvas |
| **2. Segmentation-assisted** | On-device model finds sky / moon / ridge line automatically; the effect snaps to real boundaries instead of a feathered circle/band. | ✅ Proven tech (MediaPipe / Core ML sky & object segmentation run in real time on modern phones) |
| **3. Depth-aware** | Monocular depth (or LiDAR on iPhone Pro) drives a *continuous* magnification-by-distance curve — near stays put, far grows. This is the true "perception filter." | ⚠️ Achievable: small depth models (e.g. Depth Anything V2-S) run ~15–30 fps on recent NPUs; occlusion edges need inpainting care at capture time |
| **4. Dual-lens optical detail** | Capture wide + telephoto lenses *simultaneously* (iOS multi-cam, Android logical multi-camera) and composite real tele pixels of the moon/ridge into the wide frame — real detail, not upscaled pixels. | ✅ Supported APIs; this is the quality differentiator at capture time |

**Real-time preview — your key requirement — is genuinely possible.** The strategy
(standard in computational photography):

- The **preview** runs the cheap path: segmentation/depth at low resolution and
  10–15 fps with temporal smoothing, while a GPU compositing shader renders the
  magnification effect at full 30–60 fps. What you see is a faithful preview of
  the effect.
- The **capture** re-runs the pipeline at full resolution with the expensive
  extras (tele-lens pixels, edge refinement, inpainting behind moved edges).

### What it is *not* (positioning & ethics)

Samsung's "moon AI" controversy taught the market a lesson: generating fake moon
texture destroys trust. Perception Lens is different by design — it **rescales
real captured pixels** (ideally real telephoto pixels), it never hallucinates
detail, the effect strength is a user-controlled slider, and captured images
should carry a disclosure marker (EXIF tag now, C2PA Content Credentials in the
native app). "Perception-true framing," not fabrication.

## Try the prototype now

It's a static page — camera access requires HTTPS or localhost.

```bash
cd prototype
python3 -m http.server 8080
# open http://localhost:8080 — or deploy to any static host / GitHub Pages
# and open it on your phone
```

On your phone: allow the camera, then
- **Moon mode** — tap the moon (or any distant subject), drag the *Size* and
  *Boost* sliders. A feathered magnified patch tracks live at 60 fps.
- **Ridge mode** — drag the horizon line onto the base of the mountains; everything
  above it is magnified toward the anchor, like telephoto compression.
- **Shutter** — saves the full-resolution composited JPEG.

## Repo layout

```
README.md                  this file — vision + practicality assessment
docs/PERCEPTION-MODEL.md   the math: angular size, moon illusion, gain curves
docs/ARCHITECTURE.md       native app architecture, ML models, rollout roadmap
prototype/                 zero-dependency web prototype (live preview + capture)
```

## Roadmap

1. **Now — Prototype (this repo).** Validate the *feel* of the effect and the
   default gain curve with real users on real scenes. Cheapest possible learning.
2. **v0.2 — Smart prototype.** Add in-browser segmentation (MediaPipe sky/selfie
   models via WebGPU) for auto moon/ridge detection; add EXIF disclosure tag.
3. **v1 — Native iOS first.** AVFoundation multi-cam (wide+tele), Metal preview
   shader, Core ML depth + segmentation, C2PA signing. iOS first because multi-cam
   and NPU behavior are consistent across few devices.
4. **v1.x — Android.** CameraX + logical multi-camera, MediaPipe/LiteRT models.
5. **Later.** Preset "perception profiles" (Horizon Moon, Alpine, City Skyline),
   video support, share-ready before/after export.

## Transplanting this into its own repo

This project intentionally lives on an orphan branch with no history from the
host repo. To move it to a fresh repo:

```bash
git fetch origin claude/landscape-perception-camera-filter-nqxphn
git push git@github.com:<you>/perception-lens.git \
  origin/claude/landscape-perception-camera-filter-nqxphn:refs/heads/main
```
