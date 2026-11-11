// Profils radiaux du chat. Chaque silhouette est un r(theta) echantillonne au
// meme nombre d'angles (PROFILE_SAMPLES), ce qui fait du morphing une simple
// interpolation lineaire des rayons.
//
// Les courbes sont ecrites dans `cat.ts` : tete large, joues douces, deux
// oreilles courtes et arrondies. Rien n'est releve sur une image exterieure.
// Pour changer le chat, changer les parametres de `CAT` dans `cat.ts` ; ce
// fichier ne fait que les publier sous les noms du catalogue.

import { CAT_PROFILES, type CatProfileName } from './cat'

export { PROFILE_SAMPLES } from './cat'

export const PROFILES = CAT_PROFILES

export type ProfileName = CatProfileName
