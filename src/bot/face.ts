import { clamp, loopNoise, TAU } from './math'

/**
 * Les yeux sont peints sur une sphere, pas poses a plat.
 *
 * Le modele est geometrique, pas releve : chaque oeil recupere le repere
 * tangent d'une sphere orientee par la pose de tete, puis on projette en
 * orthographique. La compression apparente, l'inclinaison et le passage
 * derriere le limbe en decoulent tout seuls, ce qui donne du volume a un
 * visage fait de deux simples ovales. Les constantes ci-dessous sont choisies
 * pour le grand visage rond du chat : deux yeux larges, poses bas et espaces.
 */

type Vec3 = [number, number, number]

/** Demi-ecart des yeux sur la sphere, en degres (separation totale 45deg). */
export const EYE_SPLIT = 22.5
/** Taille de l'oeil au repos, en unites de rayon de boule. */
export const EYE_W = 0.38
export const EYE_H = 0.46

/**
 * Orientation de tete au repos : legerement inclinee, le regard bas et doux.
 * Le tangage negatif pose les yeux sous l'equateur, ce qui est la signature
 * « gros yeux » du chat.
 */
export const REST_GAZE: HeadGaze = { yaw: 0, pitch: -12, roll: -3 }

export interface EyePose {
  x: number
  y: number
  /** matrice tangente 2x2 : [a b c d] au sens SVG matrix(a,b,c,d,e,f) */
  a: number
  b: number
  c: number
  d: number
  /** composante z de la normale : > 0 = face visible */
  depth: number
}

export interface HeadGaze {
  /** lacet, degres, positif = regarde a droite */
  yaw: number
  /** tangage, degres, positif = regarde en haut */
  pitch: number
  /** roulis, degres, inclinaison de la tete */
  roll: number
}

const deg = (d: number) => (d * Math.PI) / 180

/** Fait tourner deux vecteurs d'un repere orthonorme dans leur plan commun. */
function spin(u: Vec3, v: Vec3, angle: number): [Vec3, Vec3] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
    [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s]
  ]
}

/**
 * Repere de la tete puis des deux yeux.
 * Repere ecran : x a droite, y vers le bas, z vers le spectateur.
 * L'indice 0 est l'oeil interieur, l'indice 1 l'oeil exterieur.
 */
export function eyePoses(gaze: HeadGaze, scale: number, split = EYE_SPLIT): [EyePose, EyePose] {
  let f: Vec3 = [0, 0, 1]
  let right: Vec3 = [1, 0, 0]
  let down: Vec3 = [0, 1, 0]

  // lacet : forward bascule vers right
  ;[f, right] = spin(f, right, deg(gaze.yaw))
  // tangage : forward bascule vers le haut (donc a l'oppose de down)
  ;[down, f] = spin(down, f, deg(gaze.pitch))
  // roulis : la tete penche dans son propre plan
  ;[right, down] = spin(right, down, deg(gaze.roll))

  const build = (side: number): EyePose => {
    const [ef, er] = spin(f, right, deg(split * side))
    return {
      x: ef[0] * scale,
      y: ef[1] * scale,
      a: er[0],
      b: er[1],
      c: down[0],
      d: down[1],
      depth: ef[2]
    }
  }

  return [build(-1), build(1)]
}

/**
 * Vie au repos : derive lente du regard, saccades, clignements.
 *
 * Fonction pure du temps (aucun etat interne), donc pause, reprise et saut a
 * une date arbitraire donnent toujours la meme image. Les valeurs sont des
 * ECARTS a ajouter a la pose de l'etat courant.
 */
export interface Liveliness {
  dYaw: number
  dPitch: number
  dRoll: number
  /** 1 = oeil ouvert, 0 = ferme (ecrasement vertical en repere ecran) */
  lid: number
  driftX: number
  driftY: number
  breath: number
}

/**
 * Calendrier de clignements.
 *
 * Le calendrier est TIRE A LA DEMANDE, creneau par creneau, a partir d'un hachage
 * du numero de creneau : rien n'est pre-calcule, donc il n'a pas de fin, et
 * `blinkLid(t)` reste une fonction pure du temps — la meme date redonne toujours
 * la meme paupiere, quel que soit l'ordre des lectures. Une table pre-tiree
 * donnait la meme purete, mais s'epuisait au bout d'un quart d'heure ; un
 * generateur a etat, lui, aurait rendu `sample(t)` dependant de l'historique.
 *
 * Les intervalles sont irreguliers par construction : chaque creneau qui porte un
 * clignement le place a un decalage tire, et un creneau sur quatre environ est
 * vide, ce qui allonge la pause sans jamais la rendre periodique.
 */
const BLINK_SLOT = 2.6
/** Proportion de creneaux qui portent un clignement. */
const BLINK_CHANCE = 0.74
/** Deux a trois images a 60 Hz suffisent pour un clignement de chat. */
export const BLINK_DUR = 0.19
/** Ecart entre les deux clignements d'un clignement double. */
const BLINK_DOUBLE_GAP = 0.13
/** Proportion de clignements qui sont doubles. */
const BLINK_DOUBLE_CHANCE = 0.2

/**
 * Hachage entier -> [0, 1). Sans etat, et volontairement sans `Math.random` : le
 * meme numero de creneau doit donner le meme tirage a chaque image.
 */
function hash01(n: number, salt: number): number {
  let h = Math.imul(n ^ salt, 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Debut d'un clignement pour ce creneau, en secondes absolues. */
function blinkStart(slot: number): number {
  // On garde la duree du clignement dans le creneau : le suivant commence donc
  // toujours apres, et deux clignements doubles ne se chevauchent pas.
  return slot * BLINK_SLOT + hash01(slot, 0x1f3a) * (BLINK_SLOT - BLINK_DUR)
}

/**
 * Paupiere d'un clignement isole : 1 = ouvert, 0 = ferme.
 *
 * La fermeture occupe 42 % du clignement et demarre franchement, l'ouverture est
 * plus lente et se pose sans a-coup — c'est ce qui distingue un clignement d'un
 * simple clignotement de valeurs.
 */
function blinkWindow(t: number, start: number): number {
  const k = (t - start) / BLINK_DUR
  if (k <= 0 || k >= 1) return 1
  const CLOSE = 0.42
  if (k < CLOSE) {
    const u = 1 - k / CLOSE
    return u * u
  }
  const u = (k - CLOSE) / (1 - CLOSE)
  return u * u * (3 - 2 * u)
}

/** Paupiere apportee par un creneau donne, a l'instant `t`. */
function slotLid(slot: number, t: number): number {
  if (slot < 0) return 1
  if (hash01(slot, 0x9e37) >= BLINK_CHANCE) return 1
  const start = blinkStart(slot)
  let lid = blinkWindow(t, start)
  if (hash01(slot, 0x51ed) < BLINK_DOUBLE_CHANCE) {
    lid = Math.min(lid, blinkWindow(t, start + BLINK_DUR + BLINK_DOUBLE_GAP))
  }
  return lid
}

/**
 * Paupiere a l'instant `t`. Seuls deux creneaux sont lus : celui de `t` et le
 * precedent, parce qu'un clignement ne dure jamais plus d'un creneau et qu'un
 * double du precedent peut deborder sur celui-ci.
 */
export function blinkLid(t: number): number {
  if (t < 0) return 1
  const slot = Math.floor(t / BLINK_SLOT)
  return Math.min(slotLid(slot - 1, t), slotLid(slot, t))
}

/**
 * Respiration au repos : un cycle lent de 3,6 s, avec une amplitude crete de
 * 1,5 % du rayon. Assez pour que la boule ne soit jamais figee, assez peu pour
 * qu'on ne la voie pas gonfler — c'est un souffle, pas une pulsation.
 */
export const BREATH_PERIOD = 3.6
export const BREATH_AMPLITUDE = 0.015

/**
 * Sous « mouvement reduit », la respiration et la derive gardent leur rythme mais
 * perdent l'essentiel de leur amplitude. Le clignement, lui, n'est pas touche :
 * c'est ce qui garde le bot vivant quand le reste est apaise.
 */
export const CALM_AMPLITUDE = 0.35

export interface LivelinessOptions {
  wander?: number
  blink?: boolean
  float?: boolean
  /** true = mouvement reduit demande par le systeme */
  calm?: boolean
}

export function liveliness(t: number, opt: LivelinessOptions = {}): Liveliness {
  const { wander = 1, blink = true, float = true, calm = false } = opt
  const amp = calm ? CALM_AMPLITUDE : 1

  // Periodes premieres entre elles : la derive ne se repete jamais a l'oeil.
  return {
    dYaw: (loopNoise(t, 11.3, 0.4) * 5.5 + loopNoise(t, 3.7, 2.1) * 1.6) * wander * amp,
    dPitch: (loopNoise(t, 9.1, 1.3) * 4.2 + loopNoise(t, 4.3, 0.7) * 1.3) * wander * amp,
    dRoll: loopNoise(t, 13.7, 3.2) * 2.2 * wander * amp,
    lid: blink ? blinkLid(t) : 1,
    // Au repos le chat ne flotte pas : la vie passe par le regard, les
    // oreilles (dans les poses) et les clignements. On garde juste un souffle
    // de quelques millièmes pour que l'image ne soit pas figee.
    driftX: float ? loopNoise(t, 7.9, 1.9) * 0.006 * amp : 0,
    driftY: float ? loopNoise(t, 5.3, 0.3) * 0.007 * amp : 0,
    // La largeur est constante, seule la hauteur respire, et avec elle les
    // oreilles : elles font partie du meme profil radial.
    breath: float
      ? 1 + Math.sin((t / BREATH_PERIOD) * TAU) * BREATH_AMPLITUDE * amp
      : 1
  }
}

/**
 * Le clignement est un ecrasement VERTICAL en repere ecran autour du centre de
 * l'oeil (la largeur de la boite est conservee, la hauteur tombe presque a
 * zero), pas un retrecissement le long de l'axe incline de la gelule. On le
 * compose donc apres la matrice tangente, en n'affectant que les sorties en y.
 */
export function blinkScale(lid: number): number {
  return 0.06 + 0.94 * clamp(lid)
}
