# Déclaration d'usage de l'IA

> Exigé par le sujet (point 3). À **compléter au fil du projet** : l'absence de ce fichier vaut déclaration mensongère.
> Règle d'or : je dois pouvoir expliquer, justifier et modifier devant le jury chaque ligne de code livrée.

| Outil | Étape | Pour quoi faire | Ce que j'ai modifié / corrigé / rejeté |
|-------|-------|-----------------|----------------------------------------|
| Claude | Développement | Génération du squelette Astro + Tailwind, de la scène Three.js (bureau, caméra, écran CSS3D) | _À compléter : ce que j'ai relu, compris, changé, rejeté_ |
| _(ex. Figma AI, Midjourney…)_ | | | |

- Textes du site : **rédigés par moi** (maquette Figma), simplement repris tels quels dans le code. Seulement quelque modification apporté suite aux commentaires de la soutenance maquette. Aucun texte généré par l'IA. 

## Ce que je maîtrise et peux défendre à l'oral
- [ ] Architecture : pages Astro réelles affichées dans un `<iframe>` projeté sur l'écran 3D (CSS3DRenderer)
- [ ] Trou dans le canvas WebGL (`NoBlending`) pour laisser voir l'écran HTML derrière
- [ ] Animation caméra (GSAP) : `rig.pos`, `rig.look`, FOV
- [ ] Communication iframe ↔ scène (`postMessage`)
- [ ] Base SQLite lue au build (`src/lib/db.ts`) et admin local (`admin/server.mjs`)
- [ ] Fallback sans 3D (mobile, pas de WebGL) = version 2D de la maquette
