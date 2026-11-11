import { TAU } from './math'

/**
 * Geometrie du chat, ecrite analytiquement.
 *
 * Tout le corps du chat tient dans un profil radial r(theta) : une tete ronde
 * legerement plus large que haute, des joues qui debordent un peu en bas sur
 * les cotes, et deux oreilles courtes et arrondies posees largement sur le
 * sommet. Chaque oreille est une bosse en cosinus sureleve, donc son raccord
 * avec la tete est lisse (valeur ET pente nulles aux deux bords) : le profil
 * reste etoile vu du centre et ne fait aucun pli.
 *
 * Aucun nombre ici ne vient d'une video ou d'un autre personnage. Ils sont
 * choisis et regroupes dans `CAT`, puis reutilises par les quelques poses du
 * catalogue (`loaf`, `perk`, `tilt`). Les modifiers sont des ecarts lisibles :
 * une tete plus basse, des oreilles plus relevees, une oreille plus haute que
 * l'autre.
 *
 * Repere : theta = 0 pointe a droite, y vers le bas a l'ecran. Le sommet est
 * donc a -PI/2 et le bas a +PI/2.
 */

/** Nombre d'echantillons angulaires commun a TOUTES les silhouettes. */
export const PROFILE_SAMPLES = 64

const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * TAU)

export interface CatParams {
  /** demi-largeur de la tete, avant normalisation */
  halfWidth: number
  /** demi-hauteur de la tete, avant normalisation */
  halfHeight: number
  /** amplitude des joues, en fraction de rayon */
  cheek: number
  /** direction des joues depuis l'axe horizontal, en radians */
  cheekAngle: number
  /** largeur angulaire des joues, en radians */
  cheekWidth: number
  /** hauteur des oreilles, en fraction de rayon */
  earLift: number
  /** ecart des oreilles depuis le sommet, en radians */
  earSpread: number
  /** largeur angulaire du flanc interieur d'une oreille */
  earInner: number
  /** largeur angulaire du flanc exterieur : plus large = oreille qui part dehors */
  earOuter: number
  /** aplatissement doux du sommet entre les oreilles (valeur negative) */
  crown: number
  /** largeur de cet aplatissement */
  crownWidth: number
  /**
   * Dissymetrie des oreilles, -1 a 1. Positif = oreille gauche plus haute,
   * oreille droite plus courte. Sert a la pose `tilt`.
   */
  earSkew: number
}

/**
 * Le chat par defaut du projet. La tete fait environ 1.2 fois plus de large
 * que de haut une fois normalisee, oreilles comprises.
 */
export const CAT: CatParams = {
  halfWidth: 1.2,
  halfHeight: 0.96,
  cheek: 0.045,
  cheekAngle: 0.72,
  cheekWidth: 0.5,
  earLift: 0.26,
  earSpread: 0.62,
  earInner: 0.3,
  earOuter: 0.4,
  crown: -0.02,
  crownWidth: 0.36,
  earSkew: 0
}

/** Ramene la bosse a zero (valeur et pente) sur ses deux bords. */
function smoothBump(
  theta: number,
  center: number,
  amplitude: number,
  widthNeg: number,
  widthPos: number
): number {
  let d = theta - center
  while (d > Math.PI) d -= TAU
  while (d < -Math.PI) d += TAU
  const width = d < 0 ? widthNeg : widthPos
  if (width <= 0 || Math.abs(d) >= width) return 0
  return amplitude * 0.5 * (1 + Math.cos((Math.PI * d) / width))
}

/** Rayon de l'ellipse de tete dans la direction theta. */
function headRadius(theta: number, halfWidth: number, halfHeight: number): number {
  const x = Math.cos(theta) / halfWidth
  const y = Math.sin(theta) / halfHeight
  return 1 / Math.hypot(x, y)
}

/**
 * Profil du chat pour un jeu de parametres, normalise pour que le rayon
 * maximal vaille 1. La normalisation garde toutes les silhouettes du projet a
 * la meme echelle visuelle, comme le faisaient les anciens profils.
 */
export function catRadii(params: CatParams = CAT): number[] {
  const {
    halfWidth,
    halfHeight,
    cheek,
    cheekAngle,
    cheekWidth,
    earLift,
    earSpread,
    earInner,
    earOuter,
    crown,
    crownWidth,
    earSkew
  } = params

  const top = -Math.PI / 2
  const leftEar = top - earSpread
  const rightEar = top + earSpread
  const leftLift = earLift * (1 + earSkew)
  const rightLift = earLift * (1 - earSkew)

  const raw = ANGLES.map((theta) => {
    let r = headRadius(theta, halfWidth, halfHeight)
    // joues : deux bosses basses, symetriques, sur les cotes
    r += smoothBump(theta, cheekAngle, cheek, cheekWidth, cheekWidth)
    r += smoothBump(theta, Math.PI - cheekAngle, cheek, cheekWidth, cheekWidth)
    // oreilles : le flanc exterieur est plus large, ce qui les fait pencher dehors
    r += smoothBump(theta, leftEar, leftLift, earOuter, earInner)
    r += smoothBump(theta, rightEar, rightLift, earInner, earOuter)
    // sommet legerement aplati entre les deux oreilles
    r += smoothBump(theta, top, crown, crownWidth, crownWidth)
    return r
  })

  const peak = Math.max(...raw)
  return raw.map((r) => r / peak)
}

/** Les quatre profils du catalogue, construits a partir du meme modele. */
export const CAT_PROFILES = {
  /** le chat au repos */
  cat: catRadii(CAT),
  /** chat tasse : plus large, plus bas, oreilles couchees vers l'exterieur */
  squish: catRadii({
    ...CAT,
    halfWidth: 1.28,
    halfHeight: 0.9,
    cheek: 0.065,
    cheekAngle: 0.82,
    earLift: 0.12,
    earSpread: 0.78,
    earInner: 0.22,
    earOuter: 0.34,
    crown: 0.005,
    crownWidth: 0.5
  }),
  /** chat qui s'etire : plus etroit, oreilles hautes et rapprochees */
  perk: catRadii({
    ...CAT,
    halfWidth: 1.07,
    halfHeight: 0.98,
    cheek: 0.022,
    earLift: 0.3,
    earSpread: 0.5,
    earInner: 0.2,
    earOuter: 0.28,
    crown: -0.012,
    crownWidth: 0.3
  }),
  /** chat qui penche la tete : une oreille haute, l'autre basse */
  tilt: catRadii({
    ...CAT,
    cheek: 0.055,
    earSkew: 0.28,
    earSpread: 0.66
  })
} as const

export type CatProfileName = keyof typeof CAT_PROFILES
