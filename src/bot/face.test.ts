import { describe, expect, it } from 'vitest'
import { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE, eyePoses, type HeadGaze } from './face'

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
