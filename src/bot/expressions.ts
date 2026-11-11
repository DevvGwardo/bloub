import { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE, type HeadGaze } from './face'
import { lerp } from './math'
import type { EyeCfg } from './states'

/**
 * Expression de repos du chat.
 *
 * Le visage ne tient qu'a deux ovales, donc tout se joue sur quatre leviers :
 * l'orientation de la tete, l'ecart des yeux, leurs proportions, et
 * l'inclinaison propre de chaque oeil. Ce dernier permet la colere et la
 * tristesse, qui demandent des inclinaisons EN MIROIR (les hauts qui
 * convergent ou divergent), impossible avec le seul roulis de tete qui incline
 * les deux yeux du meme cote.
 *
 * Seul l'etat de repos porte cette expression. Les etats expressifs (clin
 * d'oeil, yeux ecarquilles, notification) gardent la leur : c'est leur pose qui
 * raconte l'animation.
 *
 * Les amplitudes sont larges mais contenues : les yeux du chat sont grands, et
 * rien ici ne doit sortir de la silhouette. Les tests d'expressions le
 * verifient sur la forme par defaut.
 */
/** Enumeres pour que la couche i18n verifie leurs traductions a la compilation. */
export type ExpressionId =
  | 'neutre'
  | 'attentif'
  | 'surpris'
  | 'excite'
  | 'heureux'
  | 'hilare'
  | 'colere'
  | 'triste'
  | 'effraye'
  | 'mefiant'
  | 'confus'
  | 'curieux'
  | 'fier'
  | 'timide'
  | 'blase'
  | 'somnolent'

export interface BotExpression {
  id: ExpressionId
  gaze: HeadGaze
  split: number
  eyes: [EyeCfg, EyeCfg]
}

/** `tilt` en degres, positif = le haut de la gelule part vers la droite. */
const eye = (w: number, h: number, tilt = 0, open = 1): EyeCfg => ({ w, h, tilt, open })

/** Les deux yeux identiques, inclinaisons en miroir si `tilt` est fourni. */
const pair = (w: number, h: number, tilt = 0, open = 1): [EyeCfg, EyeCfg] => [
  eye(w, h, tilt, open),
  eye(w, h, -tilt, open)
]

export const EXPRESSIONS: BotExpression[] = [
  {
    // la pose de repos du chat : grands yeux doux, sous l'equateur
    id: 'neutre',
    gaze: { ...REST_GAZE },
    split: EYE_SPLIT,
    eyes: [eye(EYE_W, EYE_H), eye(EYE_W, EYE_H)]
  },
  {
    id: 'attentif',
    gaze: { yaw: 5, pitch: -6, roll: -4 },
    split: 23.5,
    eyes: pair(0.35, 0.48)
  },
  {
    id: 'surpris',
    gaze: { yaw: -2, pitch: -3, roll: 0 },
    split: 25,
    eyes: pair(0.44, 0.5)
  },
  {
    id: 'excite',
    gaze: { yaw: 4, pitch: -6, roll: 0 },
    split: 26,
    eyes: pair(0.36, 0.56, -10)
  },
  {
    // yeux plisses en arc : les hauts convergent legerement
    id: 'heureux',
    gaze: { yaw: 3, pitch: -4, roll: 0 },
    split: 24,
    eyes: pair(0.36, 0.15, 14)
  },
  {
    id: 'hilare',
    gaze: { yaw: 2, pitch: 4, roll: 0 },
    split: 25,
    eyes: pair(0.38, 0.13, 20)
  },
  {
    // hauts des yeux qui convergent fort vers le centre + yeux etrecis
    id: 'colere',
    gaze: { yaw: 0, pitch: -8, roll: 0 },
    split: 23,
    eyes: pair(0.34, 0.15, 30)
  },
  {
    // l'inverse : les hauts divergent, et le regard tombe
    id: 'triste',
    gaze: { yaw: 0, pitch: -16, roll: 0 },
    split: 22,
    eyes: pair(0.24, 0.44, -28)
  },
  {
    id: 'effraye',
    gaze: { yaw: 0, pitch: -18, roll: 0 },
    split: 27,
    eyes: pair(0.4, 0.62)
  },
  {
    // un oeil franchement plus ferme que l'autre
    id: 'mefiant',
    gaze: { yaw: 10, pitch: -6, roll: -6 },
    split: 23,
    eyes: [eye(0.24, 0.46), eye(0.3, 0.15, 8)]
  },
  {
    // asymetrique sur les deux axes : tailles ET inclinaisons depareillees.
    // L'oeil plisse est volontairement tres plat (rapport 1,8) : a un rapport
    // proche de 1 il serait rond, et son inclinaison ne se verrait pas.
    id: 'confus',
    gaze: { yaw: -12, pitch: -4, roll: 7 },
    split: 23.5,
    eyes: [eye(0.22, 0.48, -18), eye(0.3, 0.17, 14)]
  },
  {
    // la tete penche : c'est le roulis qui porte la curiosite
    id: 'curieux',
    gaze: { yaw: 14, pitch: -8, roll: -14 },
    split: 23,
    eyes: [eye(0.28, 0.5, -8), eye(0.22, 0.42, -8)]
  },
  {
    id: 'fier',
    gaze: { yaw: 3, pitch: 14, roll: 0 },
    split: 24,
    eyes: pair(0.32, 0.15, 18)
  },
  {
    id: 'timide',
    gaze: { yaw: -16, pitch: -14, roll: -6 },
    split: 21,
    eyes: pair(0.2, 0.34)
  },
  {
    // fentes horizontales et regard qui part sur le cote
    id: 'blase',
    gaze: { yaw: -20, pitch: 1, roll: 0 },
    split: 23,
    eyes: pair(0.3, 0.12)
  },
  {
    // paupieres a moitie tombees : on passe par `open`, donc l'ecrasement
    // vertical a l'ecran, le meme mecanisme que le clignement
    id: 'somnolent',
    gaze: { yaw: 4, pitch: -12, roll: -3 },
    split: 22,
    eyes: pair(0.22, 0.44, 0, 0.42)
  }
]

export const EXPRESSION_BY_ID = new Map<string, BotExpression>(EXPRESSIONS.map((e) => [e.id, e]))
export const DEFAULT_EXPRESSION = 'neutre'

const lerpEyeCfg = (a: EyeCfg, b: EyeCfg, t: number): EyeCfg => ({
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
  tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t),
  open: lerp(a.open, b.open, t)
})

/** Interpolation de deux expressions : le changement se fait en glissant. */
export function blendExpression(a: BotExpression, b: BotExpression, t: number): BotExpression {
  return {
    id: b.id,
    gaze: {
      yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
      pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
      roll: lerp(a.gaze.roll, b.gaze.roll, t)
    },
    split: lerp(a.split, b.split, t),
    eyes: [lerpEyeCfg(a.eyes[0], b.eyes[0], t), lerpEyeCfg(a.eyes[1], b.eyes[1], t)]
  }
}
