# The Perception Model

How much should a distant subject be magnified so the photo matches the
experience? This document defines the terms, the baseline math, and the gain
curve the app uses. The prototype exposes the gain as a slider; the native app's
job is to make these numbers automatic-but-overridable.

## 1. Angular size — what the camera records

For an object of physical diameter `d` at distance `D`:

```
θ = 2 · atan(d / 2D)          (angular size, radians)
```

- **Moon:** d = 3 474 km, D ≈ 384 400 km → θ ≈ 0.52°
- A phone main camera has a horizontal FOV of ~70–80°. Fraction of frame width:

```
moon_width / frame_width ≈ 0.52° / 75° ≈ 0.7%
```

On a 4032-px-wide photo the moon is ~28–56 px. That is the entire "tiny moon"
problem in one number.

Equivalent focal length ↔ FOV (35 mm full-frame terms, horizontal):

| Equiv. focal length | Horiz. FOV | Moon as % of frame width |
|---|---|---|
| 24 mm (phone main) | ~74° | 0.7% |
| 50 mm ("normal")   | ~40° | 1.3% |
| 85 mm (attention view) | ~24° | 2.2% |
| 200 mm (landscape tele) | ~10° | 5.1% |
| 600 mm ("huge moon" shot) | ~3.4° | 15% |

## 2. Perceived size — what the brain records

Perceived size is *not* angular size. The visual system applies size constancy
using distance cues:

- **Moon illusion:** near the horizon, terrain cues make the moon read as
  ~1.3–2.0× its zenith apparent size (classic range across studies; individual
  variation is large).
- **Attention zoom:** when you attend to a distant subject, the effective
  "framing" your memory keeps is much tighter than the eye's ~180° panorama —
  behaviorally similar to a 40–85 mm equivalent crop.
- **Mountains:** wide-angle projection additionally *enlarges the foreground*
  (inverse-distance scaling within the frame), which relatively shrinks the
  background — the "flattened ridge" effect.

So the perception gap has two multiplicative parts:

```
G_total = G_framing × G_illusion
```

- `G_framing`: the wide-lens vs attention-view mismatch (~1.5–3.5×)
- `G_illusion`: the size-constancy boost for horizon-adjacent subjects (~1.0–2.0×)

Practical default: **G_total ≈ 2.0** for a horizon moon on a 24 mm-equivalent
camera feels "right" to most viewers; dramatic shots push toward 3.0. The
prototype's *Boost* slider covers 1.0–3.5×.

## 3. The gain curve (what the app computes)

The full model magnifies each pixel by a factor of its estimated distance:

```
g(x, y) = 1 + (G_target − 1) · s(depth(x, y))
```

where `s(·)` is a smoothstep ramp from 0 (near field, below D_near) to 1
(far field, above D_far):

```
s(D) = smoothstep(D_near, D_far, D)
D_near ≈ 50 m      (below this: never touched — people, foreground, hands)
D_far  ≈ 2 000 m   (beyond this: full perception gain — ridges, moon, clouds)
```

Modifiers:

- **Elevation term (moon illusion):** subjects within ~15° of the visible horizon
  get up to +30% extra gain, decaying with elevation angle — this reproduces the
  illusion's dependence on terrain adjacency.
- **Subject class term:** a detected moon/sun disc gets its gain applied
  radially about its own centroid (keeps the disc circular); terrain gets gain
  applied anchored at the horizon line (keeps the ground plane connected).
- **User slider:** scales `G_target`. The default is a *preset*, never a lie:
  the UI always shows the active boost value.

### Geometric application (why anchoring matters)

Magnifying a region about the wrong point creates visible tearing. Rules used by
the prototype and kept in the native design:

- **Disc subjects (moon/sun):** scale about the disc centroid; blend with a
  feathered radial mask (opaque core ~75% of radius, transparent at the edge).
  Sky behind the moon is near-uniform, which makes this blend nearly invisible.
- **Terrain (ridge mode):** scale the region above the horizon anchored at the
  horizon line and the subject's azimuth, so the seam at the ground line stays
  continuous where the viewer's eye rests. Feather the last few degrees above
  the seam. Lateral content compressed off-frame is simply cropped —
  identical to what a longer lens would have done.
- **Depth mode (native, continuous):** per-pixel displacement field from the
  gain curve; disocclusions (pixels revealed behind enlarged subjects) are
  filled from neighboring sky/background at capture time. Preview may show the
  cheap feathered approximation.

## 4. Honesty constraints

- The transform is **monotone in distance**: nothing distant is ever made
  smaller, nothing near is ever enlarged. Foreground geometry (people, buildings
  within D_near) is bit-identical to the raw capture.
- Pixels are **rescaled, never synthesized** — preferably from the telephoto
  lens's real optical detail (see ARCHITECTURE.md). No generative fill on the
  subject itself; inpainting is limited to revealed background sky.
- Every capture records the applied gain curve parameters in metadata
  (EXIF `UserComment` now; C2PA assertion in the native app).
