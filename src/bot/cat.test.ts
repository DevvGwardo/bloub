import { describe, expect, it } from 'vitest'
import { CAT, CAT_PROFILES, PROFILE_SAMPLES, catRadii } from './cat'
import { TAU } from './math'

/**
 * Le chat est dessine analytiquement, pas releve sur une image exterieure.
 * Ces tests verrouillent les proprietes dont depend le moteur, pas une
 * ressemblance : un profil etoile, lisse, et une tete franchement plus large
 * que haute, avec deux oreilles courtes et arrondies.
 */

const WIDTH_HEIGHT = (r: number[]) => {
  const xs = r.map((v, i) => v * Math.cos((i / PROFILE_SAMPLES) * TAU))
  const ys = r.map((v, i) => v * Math.sin((i / PROFILE_SAMPLES) * TAU))
  return {
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys)
  }
}

describe('geometrie du chat', () => {
  it('echantillonne tous les profils au meme nombre d angles, finis et positifs', () => {
    for (const [nom, r] of Object.entries(CAT_PROFILES)) {
      expect(r, nom).toHaveLength(PROFILE_SAMPLES)
      for (const [i, v] of r.entries()) {
        expect(Number.isFinite(v), `${nom}[${i}]`).toBe(true)
        expect(v, `${nom}[${i}]`).toBeGreaterThan(0.55)
        expect(v, `${nom}[${i}]`).toBeLessThanOrEqual(1.0001)
      }
    }
  })

  it('reste etoile et lisse : aucun saut de rayon entre deux echantillons', () => {
    for (const [nom, r] of Object.entries(CAT_PROFILES)) {
      let pire = 0
      for (let i = 0; i < PROFILE_SAMPLES; i++) {
        const suivant = (i + 1) % PROFILE_SAMPLES
        pire = Math.max(pire, Math.abs((r[suivant] ?? 0) - (r[i] ?? 0)))
      }
      // 0,18 par pas de 5,6 deg : assez pour une oreille courte, trop peu pour
      // un coin ou une auto-intersection.
      expect(pire, nom).toBeLessThan(0.18)
    }
  })

  it('a une tete environ 1,2 fois plus large que haute, oreilles comprises', () => {
    const { w, h } = WIDTH_HEIGHT(CAT_PROFILES.cat)
    expect(w / h).toBeGreaterThan(1.15)
    expect(w / h).toBeLessThan(1.25)
  })

  it('pose deux oreilles courtes et arrondies de part et d autre du sommet', () => {
    const r = CAT_PROFILES.cat
    /** Rayon dans la direction theta, par interpolation lineaire. */
    const at = (theta: number) => {
      const t = (((theta / TAU) % 1) + 1) % 1 * PROFILE_SAMPLES
      const i = Math.floor(t)
      return (r[i % PROFILE_SAMPLES] ?? 0) + ((r[(i + 1) % PROFILE_SAMPLES] ?? 0) - (r[i % PROFILE_SAMPLES] ?? 0)) * (t - i)
    }
    const gauche = -Math.PI / 2 - CAT.earSpread
    const droite = -Math.PI / 2 + CAT.earSpread
    // les deux oreilles depassent le sommet
    expect(at(gauche)).toBeGreaterThan(at(-Math.PI / 2) + 0.1)
    expect(at(droite)).toBeGreaterThan(at(-Math.PI / 2) + 0.1)
    // ...et sont largement ecartees, pas deux petites pointes au milieu
    expect(Math.abs(Math.cos(gauche) * at(gauche))).toBeGreaterThan(0.45)
    expect(Math.abs(Math.cos(droite) * at(droite))).toBeGreaterThan(0.45)
  })

  it('garde une silhouette symetrique quand earSkew vaut zero', () => {
    const r = catRadii(CAT)
    // miroir vertical : theta -> PI - theta, donc l'echantillon i repond a 32 - i
    for (let i = 0; i < PROFILE_SAMPLES; i++) {
      const miroir = (PROFILE_SAMPLES / 2 - i + PROFILE_SAMPLES) % PROFILE_SAMPLES
      expect(r[i], `echantillon ${i}`).toBeCloseTo(r[miroir] ?? 0, 10)
    }
  })

  it('donne au chat tasse une silhouette plus large et au chat etire une plus haute', () => {
    const repos = WIDTH_HEIGHT(CAT_PROFILES.cat)
    const tasse = WIDTH_HEIGHT(CAT_PROFILES.squish)
    const etire = WIDTH_HEIGHT(CAT_PROFILES.perk)
    expect(tasse.w / tasse.h).toBeGreaterThan(repos.w / repos.h)
    expect(etire.w / etire.h).toBeLessThan(repos.w / repos.h)
  })
})
