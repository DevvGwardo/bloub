# bloub

An SVG recreation of the x.ai bot avatar: **one filled black shape** that morphs
between 14 states, **two white shapes** for the eyes that morph independently, on
a plain background. No animation library.

![The avatar going through idle, wink, orbit and burst](docs/demo.gif)

## Running it

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5190.

```bash
pnpm test     # vitest
pnpm build    # vue-tsc --noEmit && vite build
pnpm build:lib # the embeddable element, in dist-lib/
```

Vue 3, Vite, TypeScript, Tailwind 4. No ESLint and no Prettier: `vue-tsc` is the
only gate, so run `pnpm build` before you call something done.

## What's in it

The rail on the left switches between three views. **Customise** offers 8 body
shapes, 12 colours and 16 rest expressions, kept between visits. **Animations** is
a small editor: arrange states into a timeline, set how long each is held, save the
result. **Settings** holds the language (French, English or Chinese) and the
credits.

Anything on screen can be exported: the avatar as SVG, PNG or an animated GIF, and
a whole timeline as GIF or MP4. The still formats need no library at all, and the
video encoder is only fetched the first time you ask for one.

Two URLs are worth knowing:

- `#planche`: the 14 states side by side, frozen. Quick visual check.
- `#etat=orbit&stop`: opens one state directly, playback paused.

![The 14 states, frozen side by side](docs/states.png)

## Why the numbers look arbitrary

They're measured, not chosen. The reference video was cut at 10 fps and each
state measured off the frames: silhouettes by sub-pixel ray casting, eyes by
capsule fitting, colours and stroke widths by direct sampling.

So the constants in the code are **measurements**, and rounding them to friendlier
values breaks the resemblance, which is the only thing this project is trying to
get right. A few are counter-intuitive enough to be worth knowing before you
correct anything:

| What you'd assume | What the video shows |
|---|---|
| The eyes lean `//` | They lean `\\`, around 26° off vertical |
| The body is a squircle | It's a perfect circle, radial deviation under 0.7% |
| Transitions are springs | Exponential ease-outs; the body never overshoots |
| The comet crosses the screen | The dot stays put, the trail orbits it |
| The avatar floats at rest | It doesn't. The life is gaze drift and blinking |

[docs/measurements.md](docs/measurements.md) has the rest, including how to
regenerate the extracted profiles.

## How it's put together

`src/bot/` is framework-free and clock-free: `engine.sample(t)` is a pure
function of time. Pausing, resuming, jumping to an arbitrary date and running
tests all produce the same image, which is what makes the frozen state board and
the DOM-less test suite possible.

| | |
|---|---|
| [docs/architecture.md](docs/architecture.md) | The engine, radial-profile morphing, eyes as mask holes |
| [docs/measurements.md](docs/measurements.md) | What was measured, and regenerating `profiles.ts` |
| [docs/intro.md](docs/intro.md) | The arrival sequence, and why it only plays one state |
| [docs/interface.md](docs/interface.md) | Layout, the three-column scene, CSS traps |
| [docs/export.md](docs/export.md) | Exporting to SVG, PNG, GIF and MP4 |
| [docs/i18n.md](docs/i18n.md) | The hand-rolled translation layer |

## Using the component

```vue
<BloubBot v-model:block="block" v-model:state="state" v-model:playing="playing" />
<BloubBot state="orbit" :size="120" :frozen-at="1.2" />
```

`block` is the playback cursor: a montage can play the same state twice, so the
index is what identifies where you are; `state` follows it as an output. Pass
`frozenAt` and the component renders one exact frame with no animation loop, which
is how the thumbnails and the state board are drawn.

Props: `size`, `shape`, `color`, `expression`, `paper`, `frozenAt`, `cycle`,
`follow`, `gaze`. Models: `block`, `state`, `playing`, `elapsed`. See
[BloubBot.vue](src/components/BloubBot.vue) for the details.

## Embedding

`pnpm build:lib` produces a self-contained ES module in
`dist-lib/bloub-avatar.js` (Vue included). Drop it on any page and importing it
registers `<bloub-avatar>`:

```html
<script type="module" src="/bloub-avatar.js"></script>

<bloub-avatar state="idle" size="160" theme="auto"></bloub-avatar>

<script type="module">
  const bot = document.querySelector('bloub-avatar')

  bot.addEventListener('statechange', (event) => {
    console.log('now showing', event.detail.state)
  })

  // Attributes and properties are both live.
  bot.state = 'wink'
  bot.setAttribute('level', '0.4')
</script>
```

| Attribute | Values | Default | What it does |
|---|---|---|---|
| `state` | `idle`, `thinking`, `wink`, `wide`, `alert`, `notify`, `exclaim`, `sleep`, `egg`, `hexagon`, `play`, `orbit`, `burst`, `comet` | `idle` | Pose to hold. Unknown values fall back to `idle`. |
| `size` | pixels, 16–1024 | `160` | Square size of the drawing. |
| `theme` | `light` \| `dark` \| `auto` | `auto` | Palette. `auto` follows `prefers-color-scheme`. |
| `level` | `0`–`1` | `0` | Talking energy: a small bob and a brighter halo. Update it from your audio or typing loop. |
| `glow` | `on` \| `off` | `off` | Soft halo behind the avatar. |
| `follow-pointer` | `on` \| `off` | `off` | Eyes track the mouse on states with a rest face (e.g. `idle`). Ignored for touch and when motion is reduced. |
| `reduced-motion` | `auto` \| `on` \| `off` | `auto` | `auto` follows the system setting. `on` freezes the avatar on the most readable pose of its state; `off` always animates. |

The element is rendered in a shadow root. Two details are worth knowing:

- In `light` the eye cut-outs are filled `#ffffff`, in `dark` `#0b0b0d`. Put the
  element on a background of the same colour, or the holes will show as light
  specks on a dark page and vice versa.
- `statechange` bubbles and is composed, so it can be listened to on the element
  or anywhere above it. `event.detail.state` is the state actually shown.

`examples/embed.html` is a live demo: run `pnpm dev` and open
<http://localhost:5190/examples/embed.html>.

## Changes

[CHANGELOG.md](CHANGELOG.md), one entry per release — which is how you tell whether the
copy you have carries a given fix.

## License

MIT. See [LICENSE](LICENSE).

Not affiliated with, endorsed by or connected to x.ai. It recreates the visual
behaviour of their bot avatar as an exercise; "Grok" and "x.ai" belong to their
owners. The MIT licence covers the code in this repository, not the design it
imitates.
