import { TAU, clamp, createRng, r2 } from './math'

/* ------------------------------------------------------------------ couleurs */

/**
 * Les anneaux sont une roue de teintes complete a luminosite constante, avec un
 * degrade le long de chaque trace. Saturation et luminosite choisies pour rester
 * lisibles sur fond clair comme sur fond sombre.
 */
function wheel(hue: number, s = 0.6, l = 0.58): string {
  const h = ((hue % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  const hex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/* ------------------------------------------------------------- types de rendu */

export interface DotRender {
  x: number
  y: number
  r: number
  opacity: number
  /** couleur explicite ; par defaut le rendu prend celle du corps */
  color?: string
  /**
   * Brume de profondeur : 0 = fondu dans le fond, 1 = couleur du corps pleine.
   * Le melange se fait au rendu, qui seul connait la couleur choisie.
   */
  depth?: number
  /**
   * Forme non circulaire, en unites de rayon de boule et centree sur l'origine
   * (le point du "!" penche est une goutte, pas un disque). Quand elle est
   * fournie, `r` n'est plus utilise pour le trace.
   */
  d?: string
  /** rotation appliquee a `d`, en degres */
  rot?: number
}

/**
 * Ce qu'un etat declare : la geometrie de l'arc reste en unites de rayon de
 * boule, c'est le moteur (seul a connaitre l'echelle du viewBox) qui la
 * rasterise. Sans ca les etats devraient connaitre le viewBox.
 */
export interface ArcSpec {
  id: string
  seed: ArcSeed
  t: number
  opacity: number
}

export interface ArcRender {
  id: string
  /** portion devant le corps */
  front: string
  /** portion derriere le corps (dessinee avant, donc masquee par la silhouette) */
  back: string
  width: number
  opacity: number
  /** degrade de teinte le long du trace */
  grad: { x1: number; y1: number; x2: number; y2: number; stops: string[] }
}

/* --------------------------------------------------------- arc elliptique 3D */

export interface ArcSeed {
  /** demi-grand axe, en unites de rayon de boule */
  a: number
  /** aplatissement b/a : les plans d'orbite sont vus par la tranche */
  k: number
  /** inclinaison du grand axe a l'ecran, radians */
  tilt: number
  /** tours par seconde */
  speed: number
  phase: number
  /** fraction du tour reellement tracee */
  sweep: number
  hue: number
  hueSpan: number
  width: number
  cx: number
  cy: number
}

/**
 * Projette un cercle 3D incline en orthographique.
 *
 * Le cercle vit dans le plan engendre par u (dans l'ecran) et v (qui plonge
 * dans la profondeur). La composante z sert a couper l'arc en deux : la moitie
 * arriere est dessinee avant le corps, donc occultee par lui. C'est ce vrai tri
 * en profondeur qui fait lire les anneaux comme des orbites et pas comme un
 * dessin plat.
 */
export function arcRender(seed: ArcSeed, t: number, scale: number, id: string, opacity = 1): ArcRender {
  const spin = seed.phase + t * seed.speed * TAU
  const cu = Math.cos(seed.tilt)
  const su = Math.sin(seed.tilt)
  const kz = Math.sqrt(Math.max(0, 1 - seed.k * seed.k))

  const N = 64
  const span = seed.sweep * TAU
  let front = ''
  let back = ''
  let prev: boolean | null = null

  for (let i = 0; i <= N; i++) {
    const th = spin + (i / N) * span
    const ct = Math.cos(th)
    const st = Math.sin(th)
    // u = (cos tilt, sin tilt, 0) ; v = (-sin tilt * k, cos tilt * k, kz)
    const x = seed.a * (ct * cu + st * -su * seed.k) + seed.cx
    const y = seed.a * (ct * su + st * cu * seed.k) + seed.cy
    const z = seed.a * st * kz

    const behind = z < 0
    const sx = r2(x * scale)
    const sy = r2(y * scale)
    const cmd = behind !== prev ? 'M' : 'L'
    if (behind) back += `${cmd}${sx} ${sy}`
    else front += `${cmd}${sx} ${sy}`
    prev = behind
  }

  const gx = Math.cos(seed.tilt) * seed.a * scale
  const gy = Math.sin(seed.tilt) * seed.a * scale
  return {
    id,
    front,
    back,
    width: seed.width * scale,
    opacity,
    grad: {
      x1: r2(seed.cx * scale - gx),
      y1: r2(seed.cy * scale - gy),
      x2: r2(seed.cx * scale + gx),
      y2: r2(seed.cy * scale + gy),
      stops: [wheel(seed.hue), wheel(seed.hue + seed.hueSpan * 0.5), wheel(seed.hue + seed.hueSpan)]
    }
  }
}

/* ---------------------------------------------------------------- anneaux */

const RING_RNG = createRng(0xa11ce)

/**
 * 6 anneaux, demi-grand axe 1.26-1.38 (donc plus grands que le chat),
 * aplatissement modere, epaisseur 0.05, ~3 tours/s. Les parametres sont
 * choisis pour donner une trajectoire ample et lisible autour de la tete.
 */
export const RINGS: ArcSeed[] = Array.from({ length: 6 }, (_, i) => ({
  a: 1.26 + RING_RNG() * 0.12,
  k: 0.06 + RING_RNG() * 0.38,
  tilt: (i / 6) * Math.PI + RING_RNG() * 0.5,
  speed: 2.8 + RING_RNG() * 0.8,
  phase: RING_RNG() * TAU,
  sweep: 0.58 + RING_RNG() * 0.26,
  hue: (i * 360) / 6 + RING_RNG() * 30,
  hueSpan: 60 + RING_RNG() * 60,
  width: 0.05 + RING_RNG() * 0.012,
  cx: 0,
  cy: 0.08
}))

/**
 * Bouquet d'arcs emboites qui accompagne le coup de patte de `swat`.
 * Vus presque par la tranche, d'ou la forme en epingle a cheveux.
 */
export const SWOOSH: ArcSeed[] = Array.from({ length: 4 }, (_, i) => ({
  a: 0.78 + i * 0.2,
  k: 0.05 + i * 0.02,
  tilt: -0.62 + i * 0.05,
  speed: 0.3,
  phase: 0.06 * i,
  sweep: 0.4,
  hue: 95 + i * 62,
  hueSpan: 100,
  width: 0.05,
  cx: 0,
  cy: -0.12
}))

/* ------------------------------------------------------------- 3 idees */

/**
 * Les trois points de `thinking` : au-dessus de l'oreille droite, du plus pres
 * au plus loin. Ils ne sont pas poses sur le contour, donc le moteur les prend
 * tels quels, en unites de rayon de boule.
 */
export const THOUGHT_DOTS = [
  { x: 0.74, y: -0.6, r: 0.045 },
  { x: 0.95, y: -0.76, r: 0.055 },
  { x: 1.13, y: -0.85, r: 0.04 }
] as const

/* ------------------------------------------------------------ particules */

const P_RNG = createRng(0xbeef)

/** 5 particules, une nouvelle toutes les 0.2 s, duree de vie 0.55 s. */
const PARTICLES = Array.from({ length: 5 }, (_, i) => ({
  birth: i * 0.2,
  angle: P_RNG() * TAU,
  rho: 0.58 + P_RNG() * 0.18
}))

/**
 * Les particules ne partent pas en ligne droite : elles spiralent vers le
 * centre (rayon x0.75 par frame, angle +100 deg/s) en grossissant, et passent
 * derriere le noyau ou elles sont avalees.
 */
export function particles(t: number, scale: number): DotRender[] {
  const out: DotRender[] = []
  for (const p of PARTICLES) {
    const u = t - p.birth
    if (u < 0 || u > 0.62) continue
    const rho = p.rho * Math.pow(0.75, u * 10)
    const a = p.angle + (u * 100 * Math.PI) / 180
    out.push({
      x: Math.cos(a) * rho * scale,
      y: Math.sin(a) * rho * scale,
      r: (0.04 + 0.028 * clamp(u / 0.55)) * scale,
      depth: clamp(1 - rho / 0.8),
      opacity: clamp(u / 0.06) * clamp((0.62 - u) / 0.08)
    })
  }
  return out
}

/* ---------------------------------------------------------- trainee du bond */

/**
 * La trainee du bond : quatre rubans qui tourbillonnent derriere le chat. Le
 * chat, lui, se ramasse au centre ; c'est la trainee qui donne la vitesse.
 * Ellipse a = 0.9, b = 0.17, grand axe incline de +32deg, ~200 deg/s.
 */
const COMET_RNG = createRng(0xc0e7)
export const COMET_RIBBONS: ArcSeed[] = Array.from({ length: 4 }, (_, i) => {
  const d = i - 1.5
  return {
    a: 0.9 * (1 + d * 0.03),
    // meme aplatissement a +-5 % pres : les rubans forment un faisceau serre
    k: (0.17 / 0.9) * (1 + d * 0.16),
    tilt: (32 * Math.PI) / 180 + d * 0.035,
    speed: 200 / 360,
    // dephasage choisi : 10 a 20 degres entre rubans, pas davantage
    phase: -i * 0.045 + COMET_RNG() * 0.012,
    sweep: 0.34,
    hue: i * 85 + COMET_RNG() * 20,
    hueSpan: 80,
    width: 0.095,
    cx: 0,
    cy: 0
  }
})

/** Echelle du chat ramasse pendant le bond. */
export const COMET_DOT = 0.22

/* --------------------------------------------------- pastille notification */

/** Bleu franc, choisi pour ressortir sur le pelage sombre comme sur le clair. */
export const NOTIF_BLUE = '#2f8fe8'
/** La pastille est posee sur le contour, a -44deg (haut droite). */
export const NOTIF_ANGLE = -44
export const NOTIF_DIST = 1
/** Rayon au repos ; le pop culmine 14 % au-dessus. */
export const NOTIF_R = 0.15
export const NOTIF_POP = 1.14
/**
 * L'encoche est un disque concentrique a la pastille, soustrait du corps.
 * La marge est constante (0.05 R) et suit l'echelle du corps.
 */
export const NOTIF_MARGIN = 0.05
