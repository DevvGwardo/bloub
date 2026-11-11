import {
  computed,
  defineComponent,
  defineCustomElement,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  useHost,
  watch,
  watchEffect,
  type PropType
} from 'vue'
import BloubBot from '@/components/BloubBot.vue'
import { POSES, STATE_BY_ID, type StateId } from '@/bot/states'

/**
 * Enveloppe publiable du bot : un element personnalise `<bloub-avatar>` qui
 * expose une surface d'attributs stable, sans rien changer au moteur ni au
 * composant de l'application.
 *
 * Le composant `BloubBot` reste la seule source du dessin. Ici on ne fait que
 * traduire des attributs en props, choisir la palette selon le theme, et couper
 * l'animation quand l'utilisateur demande moins de mouvement.
 */

type Theme = 'light' | 'dark' | 'auto'
type ReducedMotion = 'auto' | 'on' | 'off'
type OnOff = 'on' | 'off'

const TAILLE_DEFAUT = 160
const TAILLE_MIN = 16
const TAILLE_MAX = 1024

/** `glow` et `follow-pointer` acceptent `on`/`off`, mais aussi leur presence nue. */
function estActif(valeur: string | boolean): boolean {
  if (valeur === true) return true
  if (valeur === false) return false
  const mot = valeur.trim().toLowerCase()
  return mot === '' || mot === 'on' || mot === 'true' || mot === '1'
}

function media(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(query)
}

/**
 * L'element est volontairement sans ombre sur le theme : `paper` est la couleur
 * des trous d'yeux, donc il doit se confondre avec le fond de la page hote.
 * Les deux valeurs ci-dessous sont les fonds de reference des deux themes.
 */
const PALETTES = {
  light: { paper: '#ffffff', color: 'encre' },
  dark: { paper: '#0b0b0d', color: 'creme' }
} as const

const styles = `
:host {
  display: inline-block;
  vertical-align: middle;
  line-height: 0;
}
.bloub-avatar {
  position: relative;
  display: inline-block;
  line-height: 0;
}
.bloub-bot {
  display: block;
}
.bloub-glow {
  position: absolute;
  inset: -14%;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle at 50% 50%, var(--bloub-glow-color, #6ea8ff) 0%, transparent 70%);
  opacity: calc(0.18 + var(--bloub-level, 0) * 0.3);
  animation: bloub-glow 3.6s ease-in-out infinite;
}
:host([data-theme='light']) .bloub-glow {
  --bloub-glow-color: rgba(90, 140, 255, 0.8);
}
:host([data-theme='dark']) .bloub-glow {
  --bloub-glow-color: rgba(160, 196, 255, 0.85);
}
:host([data-motion='off']) .bloub-glow {
  animation: none;
}
.bloub-avatar[data-talking='on'] .bloub-bot {
  animation: bloub-talk 240ms ease-in-out infinite alternate;
  transform-origin: 50% 60%;
}
:host([data-motion='off']) .bloub-avatar[data-talking='on'] .bloub-bot {
  animation: none;
}
@keyframes bloub-glow {
  0%, 100% {
    opacity: calc(0.18 + var(--bloub-level, 0) * 0.3);
    transform: scale(0.96);
  }
  50% {
    opacity: calc(0.28 + var(--bloub-level, 0) * 0.45);
    transform: scale(1.04);
  }
}
@keyframes bloub-talk {
  from {
    transform: translateY(0) scale(1);
  }
  to {
    transform: translateY(calc(var(--bloub-level, 0) * -3px)) scale(calc(1 + var(--bloub-level, 0) * 0.012));
  }
}
@media (prefers-reduced-motion: reduce) {
  /* Filet de securite avant que le JS n'ait pose data-motion. */
  .bloub-glow {
    animation: none;
  }
}
`

const BloubAvatar = defineComponent({
  name: 'BloubAvatar',

  props: {
    /** Etat du catalogue, voir `src/bot/states.ts`. */
    state: { type: String, default: 'idle' },
    /** Cote du carre, en pixels. */
    size: { type: Number, default: TAILLE_DEFAUT },
    /** `light`, `dark`, ou `auto` pour suivre le systeme. */
    theme: { type: String, default: 'auto' },
    /** Energie de parole, de 0 a 1 : petit balancement et halo plus present. */
    level: { type: Number, default: 0 },
    /** Halo lumineux, `on` ou `off`. */
    glow: { type: [String, Boolean] as PropType<OnOff | boolean>, default: 'off' },
    /** Le regard suit le pointeur, `on` ou `off`. */
    followPointer: { type: [String, Boolean] as PropType<OnOff | boolean>, default: 'off' },
    /** `auto` suit `prefers-reduced-motion`, `on` fige, `off` anime toujours. */
    reducedMotion: { type: String, default: 'auto' }
  },

  setup(props) {
    const host = useHost()

    const darkQuery = media('(prefers-color-scheme: dark)')
    const motionQuery = media('(prefers-reduced-motion: reduce)')
    const systemDark = ref(darkQuery?.matches ?? false)
    const systemReduced = ref(motionQuery?.matches ?? false)

    function relireSysteme() {
      systemDark.value = darkQuery?.matches ?? false
      systemReduced.value = motionQuery?.matches ?? false
    }

    onMounted(() => {
      darkQuery?.addEventListener?.('change', relireSysteme)
      motionQuery?.addEventListener?.('change', relireSysteme)
    })
    onBeforeUnmount(() => {
      darkQuery?.removeEventListener?.('change', relireSysteme)
      motionQuery?.removeEventListener?.('change', relireSysteme)
    })

    const etat = computed<StateId>(() => {
      const demande = String(props.state ?? 'idle') as StateId
      return STATE_BY_ID.has(demande) ? demande : 'idle'
    })

    const taille = computed(() => {
      const n = Number(props.size)
      if (!Number.isFinite(n)) return TAILLE_DEFAUT
      return Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, Math.round(n)))
    })

    const niveau = computed(() => {
      const n = Number(props.level)
      if (!Number.isFinite(n)) return 0
      return Math.min(1, Math.max(0, n))
    })

    const theme = computed<Theme>(() => {
      const demande = String(props.theme ?? 'auto').toLowerCase()
      return demande === 'light' || demande === 'dark' ? demande : 'auto'
    })

    const themeResolu = computed<'light' | 'dark'>(() =>
      theme.value === 'auto' ? (systemDark.value ? 'dark' : 'light') : theme.value
    )

    const mouvementReduit = computed<ReducedMotion>(() => {
      const demande = String(props.reducedMotion ?? 'auto').toLowerCase()
      return demande === 'on' || demande === 'off' ? demande : 'auto'
    })

    const mouvement = computed(() =>
      mouvementReduit.value === 'off'
        ? true
        : mouvementReduit.value === 'on'
          ? false
          : !systemReduced.value
    )

    const halo = computed(() => estActif(props.glow))
    const suivi = computed(() => estActif(props.followPointer))

    /**
     * Mouvement reduit : on ne coupe pas le bot, on le fige sur la pose la plus
     * lisible de son etat. Le moteur etant une fonction pure du temps, cette
     * image ne coute pas une seule image d'animation.
     */
    const fige = computed(() => (mouvement.value ? undefined : POSES[etat.value]))

    /*
     * `level` est cense bouger a la frequence de la parole. On l'ecrit donc
     * directement dans le style de l'enveloppe, sans passer par le rendu : une
     * valeur par image ne doit pas allouer un arbre de VNodes par image.
     */
    const enveloppe = ref<HTMLElement | null>(null)
    watchEffect(
      () => {
        const el = enveloppe.value
        if (!el) return
        const n = niveau.value
        el.style.setProperty('--bloub-level', String(n))
        el.dataset.talking = n > 0.01 && mouvement.value ? 'on' : 'off'
      },
      { flush: 'post' }
    )

    /*
     * Reflets sur l'hote : ils servent au CSS du shadow root (`data-motion`),
     * et donnent a la page hote un moyen de style sans connaitre l'interieur.
     */
    watchEffect(() => {
      if (!host) return
      host.dataset.state = etat.value
      host.dataset.theme = themeResolu.value
      host.dataset.motion = mouvement.value ? 'on' : 'off'
    })

    /*
     * Un seul evenement, `statechange`, qui suit l'etat EFFECTIF : une valeur
     * inconnue retombe sur `idle`, et l'appelant est donc prevenu de la vraie
     * pose affichee. `composed` le fait traverser le shadow root, `bubbles` le
     * laisse remonter jusqu'au document.
     */
    watch(etat, (suivant) => {
      host?.dispatchEvent(
        new CustomEvent('statechange', {
          detail: { state: suivant },
          bubbles: true,
          composed: true
        })
      )
    })

    return () => {
      const palette = PALETTES[themeResolu.value]
      return h(
        'div',
        {
          ref: enveloppe,
          class: ['bloub-avatar', halo.value && 'has-glow'],
          style: `width:${taille.value}px;height:${taille.value}px`
        },
        [
          halo.value
            ? h('span', { class: 'bloub-glow', 'aria-hidden': 'true' })
            : null,
          h(BloubBot, {
            // Changer `frozenAt` ne relance pas la boucle : le composant ne la
            // demarre qu'au montage. La cle force donc un remontage quand on
            // bascule entre l'image figee et l'animation.
            key: mouvement.value ? 'vivant' : 'fige',
            class: 'bloub-bot',
            state: etat.value,
            size: taille.value,
            paper: palette.paper,
            color: palette.color,
            follow: suivi.value && mouvement.value,
            frozenAt: fige.value
          })
        ]
      )
    }
  }
})

/**
 * Classe de l'element, sans enregistrement : utile aux tests et aux hôtes qui
 * veulent choisir eux-memes le nom de balise.
 */
export const BloubAvatarElement = defineCustomElement(BloubAvatar, { styles: [styles] })

/** Enregistre `<bloub-avatar>` une seule fois. */
export function defineBloubAvatar(tagName = 'bloub-avatar'): CustomElementConstructor {
  if (typeof customElements === 'undefined') return BloubAvatarElement
  const existant = customElements.get(tagName)
  if (existant) return existant
  customElements.define(tagName, BloubAvatarElement)
  return BloubAvatarElement
}
