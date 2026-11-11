// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import './index'
import { BloubAvatarElement } from './BloubAvatar'

/**
 * L'element `<bloub-avatar>` est la surface publique d'integration. Ce qui est
 * verifie ici est ce qu'un hote peut observer : enregistrement, attributs
 * traduits, image qui change, et l'evenement `statechange`.
 */

async function stabilise() {
  await nextTick()
  await nextTick()
}

async function monte(attributs: Record<string, string> = {}) {
  const el = document.createElement('bloub-avatar')
  for (const [cle, valeur] of Object.entries(attributs)) el.setAttribute(cle, valeur)
  document.body.append(el)
  await stabilise()
  return el
}

function svgDe(el: Element): SVGSVGElement {
  const svg = el.shadowRoot?.querySelector('svg')
  expect(svg).toBeTruthy()
  return svg as SVGSVGElement
}

afterEach(async () => {
  document.body.innerHTML = ''
  await stabilise()
})

describe('bloub-avatar', () => {
  it('enregistre le tag et construit la classe annoncee', () => {
    expect(customElements.get('bloub-avatar')).toBe(BloubAvatarElement)
    expect(document.createElement('bloub-avatar')).toBeInstanceOf(BloubAvatarElement)
  })

  it('dessine le bot dans son shadow root, a la taille demandee', async () => {
    const el = await monte({ size: '220', 'reduced-motion': 'on' })
    const svg = svgDe(el)

    expect(svg.getAttribute('width')).toBe('220')
    expect(svg.getAttribute('height')).toBe('220')
    expect(svg.getAttribute('viewBox')).toBeTruthy()
    expect(el.shadowRoot?.querySelector('mask')).toBeTruthy()
  })

  it('suit les changements d attribut et emet statechange', async () => {
    const el = await monte({ 'reduced-motion': 'on' })
    const evenements: string[] = []
    el.addEventListener('statechange', (e) => {
      evenements.push((e as CustomEvent<{ state: string }>).detail.state)
    })

    const avant = svgDe(el).innerHTML
    el.setAttribute('state', 'wink')
    await stabilise()

    expect(evenements).toEqual(['wink'])
    expect(el.dataset.state).toBe('wink')
    expect(svgDe(el).innerHTML).not.toBe(avant)
  })

  it('retombe sur idle quand l etat demande n existe pas', async () => {
    const el = await monte({ state: 'wink', 'reduced-motion': 'on' })
    const evenements: string[] = []
    el.addEventListener('statechange', (e) => {
      evenements.push((e as CustomEvent<{ state: string }>).detail.state)
    })

    el.setAttribute('state', 'poulet')
    await stabilise()

    expect(evenements).toEqual(['idle'])
    expect(el.dataset.state).toBe('idle')
  })

  it('allume le halo sur on, et seulement sur on', async () => {
    const el = await monte({ 'reduced-motion': 'on' })
    const halo = () => el.shadowRoot?.querySelector('.bloub-glow')

    expect(halo()).toBeNull()

    el.setAttribute('glow', 'on')
    await stabilise()
    expect(halo()).toBeTruthy()

    // Piege classique : `glow="off"` reste une chaine vraie pour un booleen.
    el.setAttribute('glow', 'off')
    await stabilise()
    expect(halo()).toBeNull()

    el.setAttribute('glow', '')
    await stabilise()
    expect(halo()).toBeTruthy()
  })

  it('resout le theme et le refleter sur l hote', async () => {
    const el = await monte({ 'reduced-motion': 'on' })
    expect(el.dataset.theme).toBe('light')

    el.setAttribute('theme', 'dark')
    await stabilise()
    expect(el.dataset.theme).toBe('dark')

    el.setAttribute('theme', 'auto')
    await stabilise()
    expect(el.dataset.theme).toBe('light')

    el.setAttribute('theme', 'inconnu')
    await stabilise()
    expect(el.dataset.theme).toBe('light')
  })

  it('borne le niveau et ne fait parler que hors mouvement reduit', async () => {
    const el = await monte({ 'reduced-motion': 'on', level: '0.25' })
    const enveloppe = el.shadowRoot?.querySelector('.bloub-avatar') as HTMLElement

    expect(enveloppe.style.getPropertyValue('--bloub-level')).toBe('0.25')
    expect(enveloppe.dataset.talking).toBe('off')
    expect(el.dataset.motion).toBe('off')

    el.setAttribute('level', '4')
    await stabilise()
    expect(enveloppe.style.getPropertyValue('--bloub-level')).toBe('1')

    el.setAttribute('level', '-2')
    await stabilise()
    expect(enveloppe.style.getPropertyValue('--bloub-level')).toBe('0')

    el.setAttribute('level', '0.5')
    el.setAttribute('reduced-motion', 'off')
    await stabilise()
    expect(enveloppe.style.getPropertyValue('--bloub-level')).toBe('0.5')
    expect(enveloppe.dataset.talking).toBe('on')

    el.remove()
    await stabilise()
  })

  it('transmet follow-pointer au composant', async () => {
    const ecoute = vi.spyOn(window, 'addEventListener')
    const el = await monte({ 'follow-pointer': 'on' })

    expect(ecoute).toHaveBeenCalledWith('pointermove', expect.any(Function))

    el.remove()
    await stabilise()
    ecoute.mockRestore()
  })

  it('n anime pas quand reduced-motion est on, et relance au retour a off', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    const el = await monte({ 'reduced-motion': 'on' })

    expect(el.dataset.motion).toBe('off')
    expect(raf).not.toHaveBeenCalled()

    el.setAttribute('reduced-motion', 'off')
    await stabilise()

    expect(el.dataset.motion).toBe('on')
    expect(raf).toHaveBeenCalled()

    el.remove()
    await stabilise()
    raf.mockRestore()
  })
})
