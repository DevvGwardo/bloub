import { defineBloubAvatar } from './BloubAvatar'

export { BloubAvatarElement, defineBloubAvatar } from './BloubAvatar'

/*
 * Importer ce module suffit : `<bloub-avatar>` est enregistre tout de suite.
 * L'enregistrement est idempotent, donc deux bundles qui se croisent ne jettent
 * pas — le premier gagne, ce qui est le comportement attendu d'un element
 * personnalise.
 */
if (typeof window !== 'undefined') defineBloubAvatar()
