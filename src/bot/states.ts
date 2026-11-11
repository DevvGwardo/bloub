import {
  COMET_DOT,
  COMET_RIBBONS,
  NOTIF_ANGLE,
  NOTIF_DIST,
  NOTIF_MARGIN,
  NOTIF_POP,
  NOTIF_R,
  RINGS,
  SWOOSH,
  THOUGHT_DOTS,
  particles,
  type ArcSpec,
  type DotRender
} from './decor'
import { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE, type HeadGaze } from './face'
import { TAU, clamp, easings } from './math'
import { silhouette, type Silhouette } from './shape'

export interface EyeCfg {
  /** largeur locale (axe court de la gelule), en unites de rayon de boule */
  w: number
  /** hauteur locale (axe long) */
  h: number
  /** 1 = ouvert, 0 = ferme */
  open: number
  /**
   * Inclinaison propre de la gelule, en degres, positif = le haut part a
   * droite. Appliquee APRES le repere tangent de la sphere. Sans elle, les deux
   * yeux penchent forcement du meme cote (le roulis de tete) et la colere comme
   * la tristesse, qui demandent des inclinaisons en miroir, sont hors de portee.
   */
  tilt?: number
}

export interface Pose {
  /** silhouette du corps, en unites de rayon de boule */
  sil: Silhouette
  /** decalage global du corps ET des yeux */
  offX: number
  offY: number
  gaze: HeadGaze
  /** demi-ecart des yeux sur la sphere, en degres */
  split: number
  /** [oeil interieur, oeil exterieur] */
  eyes: [EyeCfg, EyeCfg]
  /** opacite des yeux : sert aux etats sans visage */
  eyeAlpha: number
  bodyAlpha: number
  dots: DotRender[]
  arcs: ArcSpec[]
  notif: { x: number; y: number; r: number; notch: number } | null
  /** true = le decor passe derriere le corps (particules de l'eclatement) */
  dotsBehind: boolean
}

const pair = (w: number, h: number, open = 1): [EyeCfg, EyeCfg] => [
  { w, h, open },
  { w, h, open }
]

/** Le chat au repos. Toutes les poses ci-dessous n'en changent qu'un morceau. */
function base(over: Partial<Pose> = {}): Pose {
  return {
    sil: silhouette('cat'),
    offX: 0,
    offY: 0,
    gaze: { ...REST_GAZE },
    split: EYE_SPLIT,
    eyes: pair(EYE_W, EYE_H),
    eyeAlpha: 1,
    bodyAlpha: 1,
    dots: [],
    arcs: [],
    notif: null,
    dotsBehind: false,
    ...over
  }
}

/** Onde de pulsation qui parcourt les trois points de gauche a droite. */
function dotPulse(t: number, index: number): number {
  const p = ((((t - index * 0.5) / 1.5) % 1) + 1) % 1
  const k = p < 0.5 ? 0.5 - 0.5 * Math.cos(p * TAU) : 0
  return clamp(k * 2)
}

/* ------------------------------------------------------------------ etats */

export type StateId =
  | 'idle'
  | 'thinking'
  | 'wink'
  | 'wide'
  | 'alert'
  | 'notify'
  | 'exclaim'
  | 'sleep'
  | 'loaf'
  | 'stretch'
  | 'swat'
  | 'chase'
  | 'puff'
  | 'pounce'
  /** transition d'interface, pas une animation du catalogue : hors `SEQUENCE` */
  | 'swirl'

export interface StateDef {
  id: StateId
  /** duree de maintien quand la sequence complete est jouee */
  duration: number
  /**
   * duree en dessous de laquelle l'animation est coupee avant d'aboutir : le
   * chat ne s'est pas encore releve, le corps reste tasse. Elle se lit dans les
   * constantes de `pose` ci-dessous, elle ne se choisit pas. Absente = l'etat
   * ignore le temps ou boucle, n'importe quelle duree lui va (voir `MIN_BLOCK`).
   */
  minDuration?: number
  /** duree du morph d'entree */
  morph: number
  /** true = l'entree est masquee par un clignement */
  blinkIn: boolean
  /**
   * true = le corps est la silhouette "au repos", donc remplacable par la forme
   * choisie dans le personnalisateur. Les etats qui dessinent leur propre pose
   * (le chat tasse, etire, en chasse, la boule du bond...) valent false : c'est
   * cette pose-la qui EST l'animation.
   */
  baseBody: boolean
  /**
   * true = l'etat porte le visage "au repos", donc remplacable par l'expression
   * choisie. Seul `idle` : les autres etats a visage ont leur propre expression,
   * c'est precisement ce qu'on vient voir.
   */
  baseFace: boolean
  pose(local: number): Pose
}

export const STATES: StateDef[] = [
  {
    id: 'idle',
    duration: 2.4,
    morph: 0.45,
    blinkIn: false,
    baseFace: true,
    baseBody: true,
    pose: () => base()
  },

  {
    id: 'thinking',
    duration: 2.6,
    morph: 0.4,
    baseFace: false,
    baseBody: true,
    blinkIn: true,
    pose: (t) => {
      const pop = 1 + 0.18 * Math.sin(clamp(t / 2.2) * Math.PI)
      return base({
        gaze: { yaw: 8, pitch: 11, roll: 4 },
        split: 22.5,
        eyes: pair(EYE_W * 0.92, EYE_H * 0.94),
        // Trois petites idees qui s'allument l'une apres l'autre au-dessus de
        // l'oreille droite. Ce sont des points du decor, pas le corps.
        dots: THOUGHT_DOTS.map((p, i) => ({
          x: p.x,
          y: p.y - 0.03 * dotPulse(t, i),
          r: p.r * (0.75 + 0.35 * dotPulse(t, i)) * pop,
          opacity: 0.5 + 0.5 * dotPulse(t, i)
        }))
      })
    }
  },

  {
    id: 'wink',
    duration: 1.6,
    morph: 0.3,
    baseFace: false,
    baseBody: true,
    blinkIn: true,
    pose: () =>
      base({
        gaze: { yaw: 4, pitch: -9, roll: 5 },
        split: 23.2,
        // L'oeil ferme n'est pas l'oeil ouvert ecrase : c'est un tiret
        // horizontal, plus large que haut, comme un sourire.
        eyes: [
          { w: EYE_W, h: EYE_H, open: 1 },
          { w: 0.32, h: 0.1, open: 1 }
        ]
      })
  },

  {
    id: 'wide',
    duration: 1.8,
    morph: 0.55,
    baseFace: false,
    baseBody: true,
    blinkIn: true,
    pose: () =>
      base({
        gaze: { yaw: -2, pitch: -7, roll: 0 },
        split: 24.5,
        eyes: pair(0.42, 0.56)
      })
  },

  {
    id: 'alert',
    duration: 1.8,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      // Le chat se redresse d'un coup, oreilles hautes, puis retombe.
      const p = easings.easeOutCubic(clamp(t / 0.32))
      const settle = easings.easeInOutCubic(clamp((t - 0.9) / 0.7))
      const up = p * (1 - settle)
      return base({
        sil: silhouette('perk', { sy: 0.94 + 0.1 * up }),
        offY: -0.055 * up,
        gaze: { yaw: 7, pitch: -4, roll: 0 },
        split: 24,
        eyes: pair(0.4, 0.54)
      })
    }
  },

  {
    id: 'notify',
    duration: 2.2,
    morph: 0.5,
    baseFace: false,
    baseBody: true,
    blinkIn: true,
    pose: (t) => {
      // Pop de la pastille : pic a +14 % vers 0,3 s puis stabilisation.
      const p = clamp(t / 0.45)
      const pop = 1 + (NOTIF_POP - 1) * Math.sin(p * Math.PI) * (1 - p * 0.35)
      const r = NOTIF_R * (p < 1 ? pop : 1)
      const a = (NOTIF_ANGLE * Math.PI) / 180
      return base({
        // le regard part a l'oppose de la pastille
        gaze: { yaw: -18, pitch: -4, roll: -6 },
        split: 23.5,
        eyes: pair(0.36, 0.42),
        notif: {
          x: Math.cos(a) * NOTIF_DIST,
          y: Math.sin(a) * NOTIF_DIST,
          r,
          notch: r + NOTIF_MARGIN
        }
      })
    }
  },

  {
    id: 'exclaim',
    duration: 1.9,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      // Sursaut : le chat se tasse puis s'etire, sans jamais depasser le cadre.
      const kick = Math.sin(clamp(t / 0.85) * Math.PI)
      return base({
        sil: silhouette('cat', {
          sx: 1 - 0.06 * kick,
          sy: 1 + 0.14 * kick
        }),
        gaze: { yaw: 0, pitch: 3, roll: 0 },
        split: 25,
        eyes: pair(0.42, 0.54)
      })
    }
  },

  {
    id: 'sleep',
    duration: 2.6,
    morph: 0.5,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) =>
      base({
        // respire lentement, tasse en pain de chat
        sil: silhouette('squish', {
          sx: 1 + 0.008 * Math.sin(t * (TAU / 2.4)),
          sy: 1 + 0.014 * Math.sin(t * (TAU / 2.4))
        }),
        gaze: { yaw: 0, pitch: -14, roll: 4 },
        split: 21,
        // deux traits fermes, pas un ecrasement de l'oeil ouvert
        eyes: pair(0.28, 0.085)
      })
  },

  {
    id: 'loaf',
    duration: 2,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: true,
    pose: (t) =>
      base({
        sil: silhouette('squish', {
          sy: 1 + 0.01 * Math.sin(t * (TAU / 2))
        }),
        gaze: { yaw: -8, pitch: -11, roll: -4 },
        split: 22,
        // paupieres basses : on passe par `open`, donc l'ecrasement vertical
        eyes: pair(0.3, 0.36, 0.45)
      })
  },

  {
    id: 'stretch',
    duration: 1.8,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: true,
    pose: (t) => {
      const up = easings.easeOutCubic(clamp(t / 0.65))
      const down = easings.easeInOutCubic(clamp((t - 1.05) / 0.6))
      const k = up * (1 - down)
      return base({
        sil: silhouette('perk', {
          sx: 1 - 0.05 * k,
          sy: 1 + 0.11 * k
        }),
        offY: -0.04 * k,
        gaze: { yaw: 3, pitch: 16, roll: 0 },
        split: 21,
        // yeux plisses de l'etirement
        eyes: pair(0.3, 0.16, 0.55)
      })
    }
  },

  {
    id: 'swat',
    duration: 2,
    morph: 0.5,
    baseFace: false,
    baseBody: false,
    blinkIn: true,
    pose: (t) => {
      const fade = clamp(t / 0.35) * clamp((2.2 - t) / 0.5)
      const swipe = Math.sin(clamp(t / 1.1) * Math.PI)
      return base({
        sil: silhouette('tilt', {
          rot: -0.1 + 0.08 * swipe,
          cx: 0.06 * swipe
        }),
        gaze: { yaw: 12, pitch: -8, roll: -6 },
        split: 23,
        eyes: pair(0.32, 0.4),
        // le bouquet balaie de la droite vers la gauche par-dessus le chat
        arcs: SWOOSH.map((s, i) => ({
          id: `sw${i}`,
          seed: { ...s, cx: 0.45 - t * 0.42 },
          t,
          opacity: fade
        }))
      })
    }
  },

  {
    id: 'chase',
    duration: 3.4,
    // le chat a fini de se remettre de sa course a 1.6 + 0.9
    minDuration: 2.5,
    morph: 0.6,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      // Rampe douce puis demi-tour complet : le chat tourne sur lui-meme en
      // suivant les anneaux, comme s'il cherchait sa queue.
      const ramp = easings.easeInOutCubic(clamp(t / 0.35))
      const rot = -TAU * 1.1 * t * ramp
      const settle = easings.easeInOutCubic(clamp((t - 1.6) / 0.9))
      const body = silhouette('cat', { rot })
      const sil: Silhouette = {
        ...body,
        sx: 1 - 0.03 * settle,
        sy: 1 + 0.03 * settle
      }
      const fade = clamp(t / 0.8) * clamp((3.6 - t) / 0.9)
      return base({
        sil,
        gaze: {
          yaw: REST_GAZE.yaw + Math.sin(t * 5.2) * 22 * (1 - settle),
          pitch: -6 + 10 * settle,
          roll: -6
        },
        split: 23,
        eyes: pair(0.32, 0.42 + 0.04 * settle),
        arcs: RINGS.map((s, i) => ({
          id: `rg${i}`,
          seed: s,
          t,
          opacity: fade * clamp((t - i * 0.13) / 0.3)
        }))
      })
    }
  },

  {
    /**
     * Entree dans la vue des reglages.
     *
     * SEUL etat qui n'est pas une animation du catalogue : il est CHOISI. Il
     * emprunte le vocabulaire de `chase` — les memes anneaux — mais coupe court :
     * 1 s au lieu de 3,4, la moitie des anneaux.
     *
     * Les deux drapeaux a `true` sont tout l'interet de cet etat :
     *
     * - `baseBody` laisse la forme choisie remplacer le corps, donc la vue peut
     *   imposer le chat ou une autre forme et elles y MORPHENT au lieu de sauter ;
     * - `baseFace` fait porter le visage de repos, donc le suivi du curseur
     *   s'applique des cette entree.
     *
     * Il n'est volontairement PAS dans `SEQUENCE` : ce n'est pas une animation du
     * catalogue, c'est une transition d'interface.
     */
    id: 'swirl',
    // un peu plus que le tour du regard (`TURN_TIME`, 1,1 s) : les yeux doivent
    // etre poses a gauche avant que les anneaux ne s'effacent
    duration: 1.3,
    minDuration: 1.3,
    morph: 0.3,
    baseFace: true,
    baseBody: true,
    blinkIn: true,
    pose: (t) =>
      base({
        // trois anneaux sur les six de `chase`
        arcs: RINGS.slice(0, 3).map((s, i) => ({
          id: `sw${i}`,
          seed: s,
          t,
          opacity: clamp((t - i * 0.06) / 0.14) * clamp((1.22 - t) / 0.34)
        }))
      })
  },

  {
    id: 'puff',
    duration: 2.6,
    // le chat est recompose a 1.7 + 0.7
    minDuration: 2.4,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      // Le chat gonfle puis s'effondre en une petite boule, avant de revenir.
      const puff = 1 + 0.12 * Math.sin(clamp(t / 0.55) * Math.PI)
      const collapse = 1 - 0.7 * easings.easeOutQuint(clamp(t / 0.7))
      const regrow = easings.easeOutQuint(clamp((t - 1.7) / 0.7))
      const k = collapse + (1 - collapse) * regrow
      return base({
        sil: silhouette('cat', { sx: k * puff, sy: k * puff }),
        eyeAlpha: clamp((t - 1.85) / 0.4),
        dots: particles(t, 1),
        dotsBehind: true
      })
    }
  },

  {
    id: 'pounce',
    duration: 2.4,
    // le chat se recompose a 1.85 + 0.6 = 2.45
    minDuration: 2.4,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      const crouch = 1 - (1 - COMET_DOT) * easings.easeOutQuint(clamp(t / 0.55))
      const regrow = easings.easeOutQuint(clamp((t - 1.85) / 0.6))
      const k = crouch + (1 - crouch) * regrow
      const fade = clamp((t - 0.15) / 0.25) * clamp((1.95 - t) / 0.3)
      return base({
        // petit balancement vertical du bond
        sil: silhouette('squish', {
          sx: k,
          sy: k,
          cy: Math.sin(clamp(t / 1.7) * Math.PI) * 0.03
        }),
        eyeAlpha: clamp((t - 2) / 0.35),
        // la trainee tourbillonne derriere le chat
        arcs: COMET_RIBBONS.map((s, i) => ({ id: `cm${i}`, seed: s, t, opacity: fade }))
      })
    }
  }
]

export const STATE_BY_ID = new Map(STATES.map((s) => [s.id, s]))

/**
 * Date, en temps local, ou chaque etat est le plus lisible : c'est la pose que
 * montrent les vignettes et la planche. Rendu deterministe, donc comparable
 * d'une execution a l'autre. Le type force a couvrir tout nouvel etat.
 */
export const POSES: Record<StateId, number> = {
  idle: 1,
  thinking: 1.1,
  wink: 0.8,
  wide: 0.8,
  alert: 0.6,
  notify: 0.9,
  exclaim: 0.7,
  sleep: 1.2,
  loaf: 0.9,
  stretch: 0.7,
  swat: 0.9,
  chase: 1.2,
  swirl: 0.5,
  puff: 0.45,
  pounce: 1.15
}

/** Ordre de lecture de la sequence complete : une petite histoire de chat. */
export const SEQUENCE: StateId[] = [
  'idle',
  'thinking',
  'wink',
  'wide',
  'alert',
  'notify',
  'exclaim',
  'sleep',
  'loaf',
  'stretch',
  'swat',
  'chase',
  'puff',
  'pounce'
]
