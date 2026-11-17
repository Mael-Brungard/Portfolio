# Gérer les projets (SQLite)

Les projets vivent dans **`db/portfolio.sqlite`**. Le site la lit au build : ce que tu changes dans la base apparaît sur le site, sans toucher au code.

## Méthode 1 — l'admin (recommandée)
```bash
npm run admin        # puis ouvre http://localhost:4400
```
Une petite interface locale (visible uniquement sur ta machine) : liste des projets, ordre ↑ ↓, publier/masquer, supprimer, formulaire d'ajout/modification.
Chaque enregistrement met aussi à jour `db/seed.sql` (la version texte de la base, à commit avec Git).

Pour voir le résultat : lance `npm run dev` dans un autre terminal (aperçu), ou `npm run build` pour publier.

## Ajouter un projet, pas à pas
1. **Prépare les images** : copie le logo dans `public/img/` (ex. `public/img/mon-projet.svg`) et les captures dans `public/img/projets/mon-projet/` (`01.webp`, `02.webp`…). Privilégie `.webp`/`.svg` et des fichiers légers (critère sobriété).
2. `npm run admin` → **+ Nouveau projet**.
3. Remplis le formulaire :
   | Champ | Rôle | Exemple |
   |---|---|---|
   | Titre | Nom affiché sur la carte et la fiche | `Mon Projet` |
   | Adresse (slug) | URL `/projets/<slug>` (auto si vide) | `mon-projet` |
   | Contexte | Libellé de la carte + filtre « Contexte » | `MMI - 2e année` |
   | Rubrique | Dans quelle liste de la page Projets | `Projets Scolaires` |
   | Logo | Chemin de l'image de la carte | `/img/mon-projet.svg` |
   | Résumé | Texte sous le titre (`**gras**` = doré) | `Un site **rapide**…` |
   | Étiquettes de la carte | 3 techs/compétences, séparées par des virgules. **Ce sont elles qui alimentent le filtre Skills** | `Astro, Tailwind, Figma` |
   | Technologies de la fiche | Liste affichée en haut de la fiche | `Astro, Tailwind, JavaScript, Figma` |
   | Contexte / Processus | Blocs de texte (voir format ci-dessous) | |
   | Galerie | Une image par ligne : `chemin \| texte alternatif` | `/img/projets/mon-projet/01.webp \| Page d'accueil` |
   | Publié | Décoche pour garder en brouillon | |
4. **Enregistrer**, puis vérifie sur `http://localhost:4321/projets`.

**Format des blocs de texte** : une ligne `## Titre`, puis le texte dessous (plusieurs lignes possibles). Exemple :
```
## Le projet
Site vitrine pour **une association**, en première année.

## Mon rôle
Maquettes **Figma** et intégration.
```
Une technologie encore inconnue (ex. `PHP`) est créée automatiquement et apparaît dans le filtre Skills.

## Ce qu'il reste à ajouter pour les projets déjà en base
- **SkillArt** : tous les textes de la maquette sont en base (Contexte et Processus). Il manque les 4 images de la Galerie : exporte-les depuis Figma (frames « image 2 », « image 3 », « image 4 », « image 12 » de la page Mobile → Projet → Galerie) vers `public/img/projets/skillart/01.png` … `04.png`, puis dans l'admin (Modifier → Galerie) colle :
  ```
  /img/projets/skillart/01.png | Description de l'image 1
  /img/projets/skillart/02.png | Description de l'image 2
  /img/projets/skillart/03.png | Description de l'image 3
  /img/projets/skillart/04.png | Description de l'image 4
  ```
- **Les 7 autres projets** : la maquette ne contient pas encore leurs textes. Leur fiche affiche « Texte en cours de rédaction » ; écris leur résumé, leurs blocs Contexte / Processus et ta galerie dans l'admin.
- **Logos** : remplace les `.svg` provisoires de `public/img/` (mêmes noms) par tes vrais logos exportés de Figma.

| Projet (slug) | Logo attendu | Dossier des captures |
|---|---|---|
| `mocktailwave` | `public/img/mocktailwave.svg` | `public/img/projets/mocktailwave/` |
| `sae-105` | `public/img/sae-105.svg` | `public/img/projets/sae-105/` |
| `matilda-presse` | `public/img/matilda-presse.svg` | `public/img/projets/matilda-presse/` |
| `redpanda-studio` | `public/img/redpanda-studio.svg` | `public/img/projets/redpanda-studio/` |
| `skillart` | `public/img/skillart.svg` | `public/img/projets/skillart/` |
| `e-commerce` | `public/img/e-commerce.svg` | `public/img/projets/e-commerce/` |
| `taverne-etudiante` | `public/img/taverne-etudiante.svg` | `public/img/projets/taverne-etudiante/` |
| `mini-jeux` | `public/img/mini-jeux.svg` | `public/img/projets/mini-jeux/` |

## Méthode 2 — SQL direct
Ouvre `db/portfolio.sqlite` avec **DB Browser for SQLite** (gratuit) ou `sqlite3`. Exemple d'ajout :
```sql
INSERT INTO projects(slug, title, logo, context_id, grp, summary, position)
VALUES ('mon-projet', 'Mon Projet', '/img/mon-projet.svg', 'mmi2', 'scolaire', 'Un site **rapide**.', 9);

INSERT INTO project_skills(project_id, skill_id, kind, position)
VALUES ((SELECT id FROM projects WHERE slug='mon-projet'), (SELECT id FROM skills WHERE name='Astro'), 'tag', 1);

INSERT INTO sections(project_id, tab, title, body, position)
VALUES ((SELECT id FROM projects WHERE slug='mon-projet'), 'contexte', 'Le projet', 'Texte avec **gras**.', 1);
```
Tables : `projects`, `project_skills` (`tag` = carte, `stack` = fiche), `sections` (`contexte` / `processus`), `gallery`, `skills`, `contexts`.
Ensuite : `npm run db:dump` pour réécrire `db/seed.sql` à partir de la base.

## Autres commandes
| Commande | Effet |
|---|---|
| `npm run db:dump` | base → `db/seed.sql` (après une modif faite avec un autre outil) |
| `npm run db:seed` | `db/seed.sql` → recrée la base (⚠ efface les modifs non exportées) |

## Ajouter un contexte (ex. « MMI 3 »)
```sql
INSERT INTO contexts(id, label, long_label, position) VALUES ('mmi3', 'MMI 3', 'MMI - 3e année', 5);
```
Il apparaît dans le filtre et dans le formulaire de l'admin.
