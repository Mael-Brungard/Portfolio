# Portfolio — Maël Brungard (Astro + Tailwind + Three.js)

Un bureau 3D, un ordinateur : un clic zoome sur l'écran, et on navigue de page en page **depuis l'écran**.

## Lancer
```bash
npm install     # Node ≥ 22.13 requis (SQLite intégré à Node, aucun module natif)
npm run dev      # http://localhost:4321
npm run build    # site statique dans /dist
```

## Comment ça marche
| Fichier | Rôle |
|---|---|
| `src/pages/index.astro` + `src/scripts/scene.ts` | La scène Three.js (décor procédural, lampe, vapeur, poussière), la caméra GSAP, l'écran CSS3D |
| `src/pages/accueil, projets, a-propos, contact…` | Les **vraies pages** de la maquette. Affichées dans l'iframe de l'écran 3D **et** utilisables seules |
| `src/scripts/page.ts` | Dialogue iframe ↔ scène (`postMessage`) : page courante, touche Échap |
| `db/schema.sql`, `db/seed.sql`, `db/portfolio.sqlite` | **Base SQLite des projets** (projets, skills, sections, galerie), lue au build par `src/lib/db.ts` |
| `src/data/content.ts` | Textes fixes (nav, à propos, coordonnées) |
| `src/styles/global.css` | Tokens Figma (couleurs, polices) + composants Tailwind |

- **Desktop avec WebGL** : `/` = scène 3D. Ouvrir `/projets` directement redirige vers `/?go=/projets` (la scène s'ouvre sur cette page).
- **Mobile / tactile / sans WebGL / `?flat`** : version 2D responsive (maquette mobile).
- **Échap**, bouton « Reculer » ou clic en dehors de l'écran : retour à la vue d'ensemble. **Entrée** (clavier) allume l'écran.
- `prefers-reduced-motion` : plus de parallaxe/poussière, transitions instantanées.

## Gérer les projets (SQLite)
`npm run admin` ouvre une interface locale (http://localhost:4400) pour ajouter, modifier, ordonner, masquer ou supprimer des projets. Guide complet : **`GESTION-PROJETS.md`**.
La base n'est lue qu'au build : le site publié reste statique.

## Navigation et animations
- Chaque changement de page : rideau doré qui se referme puis s'ouvre (`.wipe`), contenu qui apparaît en cascade (`.reveal`), Désactivé avec `prefers-reduced-motion`.
- Fiches projet et À propos : barre d'ancres collée sous l'en-tête ; un indicateur doré coulisse sous le lien actif, au scroll comme au clic (`SectionNav.astro`, scroll-spy dans `page.ts`).
- Le bouton « Retour » en haut à gauche ramène toujours à l'accueil.
- « Version 2D » mémorisée en session (`sessionStorage.flat`) ; `/?3d` revient à la scène.

## Réglages 3D
Tout en haut de `scene.ts` : taille d'écran, FOV, position de caméra, marge du zoom (`FILL`).
Intensités de lumière : `lamp` (14), `HemisphereLight` (0.55), `screenLight` — à ajuster à l'œil.

## À compléter (voir aussi IA.md / QUALITE.md / JOURNAL.md)
- [ ] Remplacer `site` dans `astro.config.mjs` + `robots.txt` par ton domaine
- [ ] Exporter les vrais logos depuis Figma vers `public/img/` (mêmes noms que les `.svg` provisoires)
- [ ] Ajouter `public/cv-mael-brungard.pdf`
- [ ] Rédiger les textes des 7 projets sans contenu (admin) et ajouter les 4 images de la galerie SkillArt (voir `GESTION-PROJETS.md`)
- [ ] Mentions légales (`src/pages/mentions-legales.astro`) : hébergeur, SIRET
- [ ] Formulaire : renseigner `PUBLIC_FORM_ENDPOINT` (voir `.env.example`)
- [ ] Police « Idiqlat » (Figma) : remplacée par Cormorant Garamond — si tu as le fichier, ajoute un `@font-face`
