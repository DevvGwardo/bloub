import { describe, expect, it } from 'vitest'
import { easings, springPulse } from './math'

/**
 * Le ressort de transition est une courbe CHOISIE, pas mesuree : ces tests
 * verrouillent ses proprietes utiles au moteur, pas ses valeurs exactes.
 */
describe('ressort de transition', () => {
  it('part de 0 et se pose exactement sur 1', () => {
    expect(easings.springOut(0)).toBe(0)
    expect(easings.springOut(1)).toBe(1)
    // une date hors de l'intervalle est bornee : `sample` doit rester pure
    expect(easings.springOut(-0.5)).toBe(0)
    expect(easings.springOut(1.5)).toBe(1)
    // et le raccord a la fin est continu, pas un saut de raccord
    expect(easings.springOut(1 - 1e-6)).toBeCloseTo(1, 5)
  })

  it('ne saute pas entre deux echantillons voisins', () => {
    let precedent = easings.springOut(0)
    for (let i = 1; i <= 1000; i++) {
      const v = easings.springOut(i / 1000)
      expect(Math.abs(v - precedent)).toBeLessThan(0.02)
      precedent = v
    }
  })

  it('depasse legerement sa cible, sans jamais 4 %', () => {
    let max = 0
    let min = 0
    for (let i = 0; i <= 2000; i++) {
      const v = easings.springOut(i / 2000)
      max = Math.max(max, v)
      min = Math.min(min, v)
    }
    // il y a bien un rebond...
    expect(max).toBeGreaterThan(1.005)
    // ...mais il reste discret
    expect(max).toBeLessThanOrEqual(1.04)
    // et la courbe ne repasse pas sous son depart
    expect(min).toBeGreaterThanOrEqual(0)
  })
})

describe('enveloppe du rebond du corps', () => {
  it('est nulle aux deux bouts, donc le raccord est exact', () => {
    expect(springPulse(0)).toBe(0)
    expect(springPulse(1)).toBe(0)
    expect(springPulse(-1)).toBe(0)
    expect(springPulse(2)).toBe(0)
  })

  it('reste dans [0, 1] et passe par un maximum au milieu', () => {
    let max = 0
    for (let i = 0; i <= 200; i++) {
      const v = springPulse(i / 200)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      max = Math.max(max, v)
    }
    // sin^2(pi t) vaut 1 en t = 0,5
    expect(max).toBeCloseTo(1, 5)
  })
})
