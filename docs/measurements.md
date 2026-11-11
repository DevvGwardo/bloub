# The cat's geometry

This fork replaces bloub's original silhouettes with an **original cat mascot**.
Nothing in `src/bot/` is traced from a video, a screenshot or another company's
character. Every radius, eye size, gaze angle and pose is authored here, in
code, and can be changed without losing a resemblance: resemblance to anything
outside this repository is explicitly not a goal.

The animation engine is bloub's, unchanged in spirit: radial profiles sampled at
the same angles, a linear radius blend, mask-hole eyes and a clock-free
`engine.sample(t)`.

## The head and the ears

`src/bot/cat.ts` builds every cat profile from one polar function:

```
r(theta) = headEllipse(theta)
         + cheekBump(theta, +cheekAngle)
         + cheekBump(theta, -cheekAngle)
         + earBump(theta, leftEar)
         + earBump(theta, rightEar)
         + crownBump(theta, top)
```

- **Head.** An ellipse, `halfWidth = 1.20`, `halfHeight = 0.96` in working
  units. After normalising the maximum radius to 1, the outline is about **1.19
  times wider than tall**, ears included.
- **Cheeks.** Two low side bumps (`cheek = 0.045`, centred 0.72 rad below the
  horizontal, half-width 0.5 rad). They give the head a soft, slightly chubby
  lower silhouette without adding a corner.
- **Ears.** Two short rounded bumps, centred **0.62 rad either side of the
  top**, with a lift of `0.26`. Their inner flank is narrower than their outer
  flank (0.30 against 0.40 rad), which makes them lean slightly outward. Because
  the bump is a raised cosine, the value and slope are both zero at each edge:
  no kink, no self-intersection, and the profile stays star-shaped from the
  centre. The tops sit well above the crown between them.
- **Crown.** A small negative bump at the exact top (`-0.02`, width 0.36) makes
  the space between the ears read as a flat-ish, soft forehead.

Every profile is sampled at `PROFILE_SAMPLES = 64` angles and normalised so its
largest radius is 1. That is what lets the engine morph any cat pose into any
customiser shape by interpolating radii index by index.

The catalogue names four profiles:

| profile  | role |
|---|---|
| `cat`    | the resting cat |
| `squish` | a wider, lower cat: ears flattened outwards, bigger cheeks |
| `perk`   | a taller, narrower cat: ears up and closer together |
| `tilt`   | resting cat with one ear higher than the other |

Changing the cat means editing `CAT` (and, if wanted, the three variants) in
`cat.ts`; `profiles.ts` only publishes them.

## Eyes

The eyes are two large ovals on a sphere:

- `EYE_SPLIT = 22.5°` half-separation (45° between centres),
- `EYE_W = 0.38`, `EYE_H = 0.46` in ball-radius units,
- `REST_GAZE = { yaw: 0, pitch: -12, roll: -3 }`.

The negative pitch puts the eyes **below the equator**, which is what gives the
cat its low, soft "big eyes" look. The pose is nearly frontal, so both eyes are
almost the same apparent width; the depth compression still follows the sphere
model exactly (`det(tangent frame) = z`).

The sphere projection is a geometric model, not a fit: each eye takes a tangent
frame oriented by the head pose and is projected orthographically. That gives
the compression, tilt and disappearance behind the limb for free, and keeps
`expressions.ts` down to four intuitive levers: head orientation, eye
separation, proportions and per-eye tilt.

Eyes are **holes in a `<mask>`**, never white shapes drawn on top. That is why
they clip against the silhouette on their own. The notification pastille uses
the same mask for its notch.

## Poses

`states.ts` tells a small cat story: `idle`, `thinking`, `wink`, `wide`,
`alert`, `notify`, `exclaim`, `sleep`, `loaf`, `stretch`, `swat`, `chase`,
`puff`, `pounce`. (`swirl` is the settings-view transition and deliberately
sits outside `SEQUENCE`.)

- Shape-changing poses hide the change behind a blink (`blinkIn`), just as the
  engine has always done.
- `loaf`, `stretch`, `swat`, `chase`, `puff` and `pounce` draw their own
  silhouette and are not replaced by a customiser shape.
- `minDuration` is read from the pose's own constants: `puff` and `pounce`
  need 2.4 s to come back together, `chase` 2.5 s to settle.
- Transitions remain exponential ease-outs; the body never overshoots. The only
  spring is the notification pop.

## Regenerating the profiles

There is no extractor any more. `profiles.ts` is a thin re-export of
`cat.ts`; change the parameters and the profiles follow at import. The old
`tools/extract-profiles.py` and its `reference.mp4` / `frames/` inputs were
removed because they encoded the previous mascot.

## The favicon is not an approximation

`public/favicon.svg` is generated from the engine: the body path and both eye
matrices are what `engine.sample(1)` returns for `idle`, not a separate drawing.
`favicon.ico` and `apple-touch-icon.png` are rasterised from that SVG.
`docs/demo.gif` and `docs/states.png` come from the same source: walk
`engine.sample(t)`, write the SVG layers in `BloubBot.vue`'s order, then
rasterise. They are not browser screenshots.
