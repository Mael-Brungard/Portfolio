# Grille de contrôle qualité (adaptée à CE site)

> À remplir avec les critères **retenus pour ce site**, l'outil utilisé, le résultat et ce qui a été corrigé.
> Une grille générique recopiée sans rapport démontré ne vaut rien.

## Accessibilité
| Critère retenu (pourquoi il compte ici) | Outil / méthode | Résultat | Correction |
|---|---|---|---|
| Alternative sans 3D (la scène ne doit pas être obligatoire) | Test mobile + WebGL désactivé | | |
| Navigation clavier de la scène (Entrée = allumer, Échap = reculer) | Test manuel | | |
| `prefers-reduced-motion` respecté | DevTools > Rendering | | |
| Contrastes or `#e6c280` sur `#332013` | | | |

## Sobriété & performance
| Critère | Outil | Résultat | Correction |
|---|---|---|---|
| Poids de `/` (three.js chargé seulement sur la scène) | DevTools Network | | |
| Poids des pages 2D (HTML + CSS, 0 JS lourd) | Lighthouse / EcoIndex | | |

## Référencement
| Critère | Outil | Résultat | Correction |
|---|---|---|---|
| Pages réelles indexables (`/accueil`, `/projets`…) malgré la scène | Vue source | | |
| title / description / canonical / JSON-LD | | | |

## Conformité juridique
| Critère | Résultat | Correction |
|---|---|---|
| Mentions légales (`/mentions-legales`) complétées | | |
| Droits des images / logos de projets | | |
| Formulaire de contact : RGPD (finalité, pas de stockage inutile) | | |
