import { describe, expect, it } from 'vitest'
import {
  BLINK_DUR,
  blinkLid,
  blinkScale,
  BREATH_AMPLITUDE,
  BREATH_PERIOD,
  EYE_H,
  EYE_SPLIT,
  EYE_W,
  liveliness,
  REST_GAZE,
  eyePoses,
  type HeadGaze
} from './face'

/**
 * Le visage du chat : deux grands ovales poses sur une sphere. Le modele est
 * geometrique, donc les invariants ci-dessous valent pour n'importe quelle
 * pose. Les quelques valeurs attendues sont celles du repos, choisies pour le
 * chat (yeux bas, larges et symetriques), pas relevees sur une image.
 */

const court = (e: ReturnType<typeof eyePoses>[number], w: number) => Math.hypot(e.a, e.b) * w
const long = (e: ReturnType<typeof eyePoses>[number], h: number) => Math.hypot(e.c, e.d) * h

describe('yeux poses sur une sphere', () => {
  it('pose les deux yeux bas, larges et presque symetriques au repos', () => {
    const [gauche, droite] = eyePoses(REST_GAZE, 1)
    // ecart horizontal : deux yeux bien separes, de part et d'autre du nez
    expect(gauche.x).toBeLessThan(-0.34)
    expect(droite.x).toBeGreaterThan(0.34)
    expect(Math.abs(gauche.x + droite.x)).toBeLessThan(0.02)
    // hauteur : sous l'equateur, la signature « gros yeux » du chat
    expect(gauche.y).toBeGreaterThan(0.12)
    expect(droite.y).toBeGreaterThan(0.12)
    // et une inclinaison de tete de quelques degres seulement
    expect(Math.abs(gauche.y - droite.y)).toBeLessThan(0.06)
  })

  it('donne aux deux yeux la taille du repos, sans compression laterale', () => {
    // visage presque frontal : les deux profondeurs sont egales, donc aucune
    // compression de perspective entre l'oeil interieur et l'exterieur
    const [gauche, droite] = eyePoses(REST_GAZE, 1)
    expect(Math.abs(droite.depth / gauche.depth - 1)).toBeLessThan(0.03)
    expect(Math.abs(court(droite, EYE_W) / court(gauche, EYE_W) - 1)).toBeLessThan(0.03)
    // la hauteur garde la taille de la gelule, au raccourcissement pres du a
    // l'inclinaison de la tete
    const hauteur = long(droite, EYE_H)
    expect(hauteur).toBeLessThanOrEqual(EYE_H)
    expect(hauteur).toBeGreaterThan(EYE_H * 0.95)
  })

  it('comprime l oeil exactement du facteur de profondeur de la sphere', () => {
    // Invariant exact : le determinant du repere tangent projete vaut z.
    for (const gaze of [REST_GAZE, { yaw: -34, pitch: 8, roll: 5 }]) {
      for (const e of eyePoses(gaze, 1)) {
        expect(e.a * e.d - e.b * e.c).toBeCloseTo(e.depth, 6)
      }
    }
    // et la largeur apparente suit ce meme facteur : un oeil qui part vers le
    // limbe se comprime au lieu de glisser a taille constante
    const [loin, proche] = eyePoses({ yaw: -55, pitch: 0, roll: 0 }, 1)
    expect(loin.depth).toBeLessThan(proche.depth)
    expect(court(loin, EYE_W) / court(proche, EYE_W)).toBeLessThan(1)
  })

  it('garde la meme longueur pour les deux yeux (axe tangentiel non deforme)', () => {
    const [a, b] = eyePoses(REST_GAZE, 1)
    expect(long(a, EYE_H)).toBeCloseTo(long(b, EYE_H), 3)
  })

  it('conserve la separation angulaire demandee quel que soit le regard', () => {
    for (const gaze of [REST_GAZE, { yaw: -40, pitch: 10, roll: 5 }, { yaw: 0, pitch: 0, roll: 0 }]) {
      const [a, b] = eyePoses(gaze, 1)
      const dot = a.x * b.x + a.y * b.y + a.depth * b.depth
      expect((Math.acos(dot) * 180) / Math.PI).toBeCloseTo(EYE_SPLIT * 2, 4)
    }
  })

  it('fait passer un oeil derriere la sphere quand la tete tourne fort', () => {
    const [, loin] = eyePoses({ yaw: 80, pitch: 0, roll: 0 }, 1)
    expect(loin.depth).toBeLessThan(0)
  })

  it('accepte les regards du catalogue sans perdre un oeil', () => {
    const GAZES: HeadGaze[] = [
      { yaw: 0, pitch: -18, roll: 0 },
      { yaw: 14, pitch: -8, roll: -14 },
      { yaw: -20, pitch: 1, roll: 0 }
    ]
    for (const gaze of GAZES) {
      const poses = eyePoses(gaze, 1)
      for (const p of poses) expect(p.depth).toBeGreaterThan(0.2)
    }
  })
})

/** Premier instant ou la paupiere est franchement fermee, par balayage. */
function firstClosure(from = 0, span = 20): number {
  for (let t = from; t < from + span; t += 1 / 240) {
    if (blinkLid(t) < 0.01) return t
  }
  throw new Error(`aucun clignement entre ${from} et ${from + span} s`)
}

describe('clignements', () => {
  it('tire le meme calendrier a chaque lecture, dans n importe quel ordre', () => {
    // La purete de `sample(t)` en depend : le calendrier est un hachage du
    // numero de creneau, et non un generateur dont l'etat avance a chaque image.
    const probes = [0.1, 1.37, 5.2, 12.7, 60.4, 151.9]
    const avant = probes.map(blinkLid)
    const arriere = [...probes].reverse().map(blinkLid).reverse()
    expect(arriere).toEqual(avant)
    for (const lid of avant) {
      expect(lid).toBeGreaterThanOrEqual(0)
      expect(lid).toBeLessThanOrEqual(1)
    }
  })

  it('se repete a l identique quand on relit une date passee', () => {
    const premiere = blinkLid(firstClosure() + 0.05)
    // on lit loin devant, puis on revient : rien ne doit avoir bouge
    for (let t = 0; t < 500; t += 7.3) blinkLid(t)
    expect(blinkLid(firstClosure() + 0.05)).toBe(premiere)
  })

  it('ferme l oeil en un ecrasement bref, pas en un fondu de couleurs', () => {
    const t = firstClosure()
    // la paupiere atteint le bas du clignement...
    expect(blinkLid(t)).toBeLessThan(0.01)
    // ...et l'ecrasement vertical qui en decoule est presque total
    expect(blinkScale(blinkLid(t))).toBeLessThan(0.1)
    // ouvert, l'oeil reprend exactement sa taille
    expect(blinkScale(1)).toBe(1)
    // un clignement de chat tient en quelques images a 60 Hz
    expect(BLINK_DUR).toBeGreaterThan(0.12)
    expect(BLINK_DUR).toBeLessThan(0.25)
  })

  it('garde des intervalles irreguliers, avec des clignements doubles', () => {
    const dt = 1 / 240
    const debuts: number[] = []
    let precedent = blinkLid(0)
    for (let t = 0; t <= 60; t += dt) {
      const lid = blinkLid(t)
      if (precedent >= 0.2 && lid < 0.2) debuts.push(t)
      precedent = lid
    }
    const ecarts = debuts.slice(1).map((t, i) => t - debuts[i]!)

    // environ vingt clignements par minute, sans battement metronomique
    expect(debuts.length).toBeGreaterThan(15)
    expect(Math.max(...ecarts) - Math.min(...ecarts)).toBeGreaterThan(1.5)
    expect(new Set(ecarts.map((e) => e.toFixed(2))).size).toBeGreaterThan(10)

    // un double clignement : deux fermetures a moins d'une demi-seconde...
    expect(ecarts.some((e) => e < 0.5)).toBe(true)
    // ...et des pauses plus longues que la moyenne, tirees par un creneau vide
    expect(ecarts.some((e) => e > 3)).toBe(true)
  })

  it('garde le clignement sous mouvement reduit', () => {
    // Le reglage apaise l'amplitude, pas le rythme : retirer le clignement
    // laisserait une image morte au lieu d'un mouvement calme.
    const t = firstClosure()
    expect(liveliness(t, { calm: true }).lid).toBeLessThan(0.01)
    expect(liveliness(t, { calm: false }).lid).toBe(liveliness(t, { calm: true }).lid)
  })
})

describe('respiration', () => {
  it('fait un cycle de trois a quatre secondes, d environ 1,5 %', () => {
    let min = Infinity
    let max = -Infinity
    for (let t = 0; t <= BREATH_PERIOD; t += BREATH_PERIOD / 400) {
      const b = liveliness(t).breath
      min = Math.min(min, b)
      max = Math.max(max, b)
    }
    expect(BREATH_PERIOD).toBeGreaterThanOrEqual(3)
    expect(BREATH_PERIOD).toBeLessThanOrEqual(4)
    // amplitude crete : la moitie de l'ecart entre le plein et le vide
    expect((max - min) / 2).toBeCloseTo(BREATH_AMPLITUDE, 4)
  })
})
