# Architecture & Rollout

What it takes to ship Perception Lens for real, beyond the web prototype.
The design goal driving everything: **the live preview must be a faithful
preview of the final image**, and the final image must be built from real
captured pixels.

## System overview

```
                ┌────────────────────────────────────────────────┐
                │                 CAPTURE SESSION                │
                │  wide lens (24mm) ──┐        ┌── tele lens     │
                │                     ▼        ▼   (3–5x, if any)│
                │              synchronized frame pairs          │
                └───────────────┬────────────────┬───────────────┘
                                │ preview (30fps)│ still (on shutter)
                                ▼                ▼
    ┌───────────────────────────────┐   ┌─────────────────────────────────┐
    │ REALTIME PATH (GPU + NPU)     │   │ CAPTURE PATH (async, ~1–2s)     │
    │ • downscaled frame → NPU:     │   │ • full-res wide + tele frames   │
    │   sky/subject segmentation    │   │ • full-res segmentation + depth │
    │   (+ depth @ 10–15fps)        │   │ • tele pixels registered onto   │
    │ • temporal smoothing (EMA)    │   │   wide frame at subject region  │
    │ • compositing shader applies  │   │ • displacement field + edge     │
    │   gain curve @ 30–60fps       │   │   refinement + sky inpaint      │
    │ • UI overlays (anchors, gain) │   │ • encode + metadata (EXIF/C2PA) │
    └───────────────────────────────┘   └─────────────────────────────────┘
```

Key trick: the preview never blocks on ML. Segmentation/depth run on a few
frames per second at low resolution; the compositing shader consumes the most
recent (smoothed) masks every display frame. The effect therefore *tracks*
slightly behind fast camera motion but always renders fluidly — the standard
approach used by portrait-mode previews.

## Platform choices

### iOS first (recommended)

| Concern | Choice |
|---|---|
| Camera | `AVCaptureMultiCamSession` — simultaneous wide + tele streams; falls back to single-cam digital scale on non-Pro devices |
| Preview render | Metal shader (`CAMetalLayer`), compositing at display rate |
| Segmentation | Vision/`VNGeneratePersonSegmentation`-style pipeline with a custom Core ML sky/celestial model; Apple's built-in saliency + horizon detection help |
| Depth | LiDAR (`AVDepthData`) on Pro devices; Depth Anything V2-S (Core ML, ANE) elsewhere |
| Capture | `AVCapturePhotoOutput` full-res pair; processing in a background task |
| Provenance | ImageIO EXIF writes + C2PA via the c2pa-ios SDK |

Why iOS first: multi-cam API is mature, NPU (ANE) behavior is uniform across a
handful of devices, and the landscape-photo enthusiast demographic skews iPhone.

### Android second

CameraX + logical multi-camera (quality varies by OEM — gate the dual-lens path
by device capability), LiteRT (TFLite) with GPU/NNAPI delegates for the same
models, OpenGL/Vulkan compositing. Expect a device-capability tier system:
Tier A (dual-lens optical), Tier B (single-lens, depth model), Tier C (geometric
prototype-level effect only).

### Why not cross-platform (Flutter/React Native)?

The core of this app *is* a per-frame native GPU/NPU pipeline. Cross-platform UI
shells add friction exactly where the product lives. Native twice is the honest
cost. (The web prototype remains the cheap experimentation sandbox.)

## Models

| Task | Candidate | Budget |
|---|---|---|
| Sky / horizon segmentation | MediaPipe-class lightweight U-Net, or Apple built-ins | < 5 ms @ 256px on NPU |
| Moon/sun disc detection | Trivial: brightest circular blob in sky mask (Hough) — no ML needed | < 1 ms |
| Monocular depth | Depth Anything V2-S distilled, quantized | 15–30 fps @ 384px on A16+/SD 8g2+ |
| Edge refinement (capture only) | Guided filter / matting on full-res | ~200 ms, async |
| Sky inpaint behind moved edges (capture only) | Classical (PatchMatch-style) — deliberately non-generative | ~300 ms, async |

## The dual-lens quality play

Digital magnification of a 28-px moon gives mush. The differentiator: while
previewing with the wide lens, simultaneously capture the telephoto stream. At
shutter time, register the tele frame's moon/ridge region into the composited
wide frame. A 5× tele gives the moon ~140 real pixels — crisp craters with zero
generative AI. This is the feature that makes the output defensible: every pixel
was captured by the user's own camera at that moment.

## Trust & disclosure (non-negotiable)

- Effect strength always visible in the UI while shooting (e.g. "2.0×").
- EXIF `UserComment` + XMP record the gain curve; native app adds C2PA Content
  Credentials ("size-of-distant-subjects adjusted; no content generated").
- A one-tap before/after toggle on every captured photo.

## Team & effort (rough order of magnitude)

| Phase | Scope | Effort |
|---|---|---|
| Prototype validation | this repo + user tests | days |
| v0.2 smart web prototype | WebGPU segmentation, auto-moon | 2–4 weeks, 1 eng |
| v1 iOS | pipeline above, single + dual-lens | ~3 months, 2 eng (1 camera/Metal, 1 ML) + design |
| v1.x Android | tiered port | ~2–3 months, 2 eng |

Biggest technical risks, in order:
1. **Seam quality in terrain mode** at capture resolution (mitigation: horizon
   anchoring + depth-continuous displacement rather than hard bands).
2. **Depth model stability** frame-to-frame (mitigation: temporal EMA, keyframe
   re-estimation, effect anchored to tracked features via ARKit/ARCore VIO).
3. **Android device fragmentation** for multi-cam (mitigation: tier system).
4. **Perception calibration** — the default curve must feel "true," not "edited"
   (mitigation: that's exactly what the prototype phase measures).
