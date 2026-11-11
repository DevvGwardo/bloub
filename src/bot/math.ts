export const TAU = Math.PI * 2

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export type Easing = (t: number) => number

/* ------------------------------------------------------------- ressort de transition */

/**
 * Parametres du ressort de transition, choisis et non mesures.
 *
 * `SPRING_DAMPING` juste sous 1 : la pose depasse sa cible de ~0,8 % avant de se
 * poser, ce qui suffit a lire un rebond sans jamais donner l'impression qu'elle
 * rate son arrivee; le corps ajoute son propre rebond par-dessus (`BODY_SPRING`),
 * borne a 4 % au total. `SPRING_OMEGA` regle la vitesse : a 9.5 le ressort a
 * pratiquement fini au bout du temps normalise (t = 1). `SPRING_VELOCITY` est la
 * vitesse de depart : sans elle un ressort critique demarre mou ; a 2.2 il part
 * franchement, comme l'ease-out qu'il remplace.
 */
const SPRING_DAMPING = 0.84
const SPRING_OMEGA = 9.5
const SPRING_VELOCITY = 2.2

/** Pulsation amortie, et decroissance, calculees une fois. */
const SPRING_DECAY = SPRING_DAMPING * SPRING_OMEGA
const SPRING_PULSE = SPRING_OMEGA * Math.sqrt(1 - SPRING_DAMPING ** 2)

/**
 * Reponse d'un oscillateur amorti a un echelon, en forme close.
 *
 *     x(t) = 1 - e^(-z w t) [ cos(wd t) + ((z w - v0) / wd) sin(wd t) ]
 *
 * Aucun integrateur, aucun etat : `t` est le seul argument, donc relire une date
 * passee redonne exactement la meme valeur. Avec v0 > 0 la courbe demarre avec
 * cette pente au lieu de partir de l'arret.
 */
function springStep(t: number): number {
  const c = (SPRING_DECAY - SPRING_VELOCITY) / SPRING_PULSE
  return 1 - Math.exp(-SPRING_DECAY * t) * (Math.cos(SPRING_PULSE * t) + c * Math.sin(SPRING_PULSE * t))
}

/**
 * La valeur atteinte a t = 1 sert de reference : on divise par elle pour que la
 * courbe tombe EXACTEMENT sur 1 a la fin du morph. Sans ca le fondu se couperait
 * sur un residu de 0,04 %, invisible mais qui rendrait la courbe discontinue au
 * raccord avec la pose d'arrivee.
 */
const SPRING_STEP_1 = springStep(1)

/**
 * Easing de transition : part de 0, depasse legerement 1 (~0,8 %), puis s'y pose.
 * Bornee a [0, 1] hors de l'intervalle pour que `sample` reste pure meme si on
 * lui demande une date anterieure au changement d'etat.
 */
export const springOut: Easing = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : springStep(t) / SPRING_STEP_1

/**
 * Enveloppe du rebond du corps : un demi-tour de sinusoide au carre, nul aux
 * deux bouts. Elle vaut 0 au debut et a la fin du fondu, donc le raccord avec
 * les deux poses est exact, et reste dans [0, 1] entre les deux.
 *
 * C'est une fonction du temps, pas un ressort a memoire : la meme date redonne
 * la meme valeur.
 */
export function springPulse(t: number): number {
  if (t <= 0 || t >= 1) return 0
  const s = Math.sin(Math.PI * t)
  return s * s
}

export const easings = {
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutQuint: (t: number) => 1 - (1 - t) ** 5,
  springOut
} satisfies Record<string, Easing>

/** Bruit 1D periodique : boucle sans couture sur `period`, utile pour la derive du regard. */
export function loopNoise(t: number, period: number, seed = 0): number {
  const p = (t / period) * TAU
  return (
    0.55 * Math.sin(p + seed) +
    0.3 * Math.sin(2 * p + seed * 1.7 + 1.1) +
    0.15 * Math.sin(3 * p + seed * 2.3 + 2.4)
  )
}

/** PRNG deterministe (mulberry32) : meme sequence a chaque lecture. */
export function createRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Arrondi court : divise par ~2 le poids des chaines de path generees a 60 fps. */
export const r2 = (v: number) => Math.round(v * 100) / 100
