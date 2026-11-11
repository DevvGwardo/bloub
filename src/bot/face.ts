import { clamp, createRng, loopNoise } from './math'

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

const BLINK_RNG = createRng(0x5eed)
/** Calendrier de clignements pre-tire : deterministe et sans etat. */
const BLINKS: number[] = (() => {
  const out: number[] = []
  let t = 1.4
  while (t < 900) {
    out.push(t)
    // 1.9 a 4.6 s entre deux clignements, plus un double clignement parfois
    t += 1.9 + BLINK_RNG() * 2.7
    if (BLINK_RNG() < 0.18) {
      out.push(t)
      t += 0.24
    }
  }
  return out
})()

/** Deux a trois images a 60 Hz suffisent pour un clignement de chat. */
const BLINK_DUR = 0.18

function blinkLid(t: number): number {
  for (let i = 0; i < BLINKS.length; i++) {
    const start = BLINKS[i]!
    if (t < start) break
    const k = (t - start) / BLINK_DUR
    if (k >= 0 && k <= 1) {
      // fermeture rapide, reouverture un peu plus lente
      return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55
    }
  }
  return 1
}

export interface LivelinessOptions {
  wander?: number
  blink?: boolean
  float?: boolean
}

export function liveliness(t: number, opt: LivelinessOptions = {}): Liveliness {
  const { wander = 1, blink = true, float = true } = opt

  // Periodes premieres entre elles : la derive ne se repete jamais a l'oeil.
  return {
    dYaw: (loopNoise(t, 11.3, 0.4) * 5.5 + loopNoise(t, 3.7, 2.1) * 1.6) * wander,
    dPitch: (loopNoise(t, 9.1, 1.3) * 4.2 + loopNoise(t, 4.3, 0.7) * 1.3) * wander,
    dRoll: loopNoise(t, 13.7, 3.2) * 2.2 * wander,
    lid: blink ? blinkLid(t) : 1,
    // Au repos le chat ne flotte pas : la vie passe par le regard, les
    // oreilles (dans les poses) et les clignements. On garde juste un souffle
    // de quelques millièmes pour que l'image ne soit pas figee.
    driftX: float ? loopNoise(t, 7.9, 1.9) * 0.006 : 0,
    driftY: float ? loopNoise(t, 5.3, 0.3) * 0.007 : 0,
    // La largeur est constante, seule la hauteur respire tres legerement.
    breath: float ? 1 + Math.sin((t / 3.4) * Math.PI * 2) * 0.005 : 1
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
