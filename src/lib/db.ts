/**
 * Accès à la base SQLite des projets (db/portfolio.sqlite).
 * Utilisé UNIQUEMENT au build (frontmatter Astro) : le site publié reste 100 % statique.
 * Modifier un projet = modifier la base (DB Browser for SQLite, ou db/seed.sql + bun run db:seed) puis rebuild.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type Section = { title: string; body: string };
export type Project = {
  slug: string; title: string; logo: string; summary: string;
  context: string; contextId: string; group: 'scolaire' | 'perso-pro';
  tags: string[]; stack: string[];
  contexte: Section[]; processus: Section[]; galerie: { src: string; alt: string }[];
};

// SQLite intégré à Node ≥ 22.13 : aucun module natif à compiler (donc rien à installer, quel que soit l'OS).
const { DatabaseSync } = (process as any).getBuiltinModule('node:sqlite');

const file = join(process.cwd(), 'db', 'portfolio.sqlite');

function connect() {
  if (!existsSync(file)) { // première exécution : on construit la base depuis le SQL versionné
    const w = new DatabaseSync(file);
    w.exec(readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8'));
    w.exec(readFileSync(join(process.cwd(), 'db', 'seed.sql'), 'utf8'));
    w.close();
  }
  return new DatabaseSync(file, { readOnly: true });
}

let cacheMtime = 0;
let cache: { projects: Project[]; skills: string[]; contexts: { id: string; label: string }[] } | null = null;

function load() {
  if (existsSync(file)) { const m = statSync(file).mtimeMs; if (m !== cacheMtime) { cache = null; cacheMtime = m; } } // base modifiée → on relit
  if (cache) return cache;
  const db = connect();
  try {
    const rows = db.prepare(
      `SELECT p.id, p.slug, p.title, p.logo, p.summary, p.grp, c.id AS context_id, c.long_label
         FROM projects p JOIN contexts c ON c.id = p.context_id
        WHERE p.published = 1 ORDER BY p.position`,
    ).all() as any[];

    const skillsOf = db.prepare(
      `SELECT s.name FROM project_skills ps JOIN skills s ON s.id = ps.skill_id
        WHERE ps.project_id = ? AND ps.kind = ? ORDER BY ps.position`,
    );
    const sectionsOf = db.prepare('SELECT title, body FROM sections WHERE project_id = ? AND tab = ? ORDER BY position');
    const galleryOf = db.prepare('SELECT src, alt FROM gallery WHERE project_id = ? ORDER BY position');

    const projects: Project[] = rows.map((r) => ({
      slug: r.slug, title: r.title, logo: r.logo, summary: r.summary,
      context: r.long_label, contextId: r.context_id, group: r.grp,
      tags: (skillsOf.all(r.id, 'tag') as any[]).map((s) => s.name),
      stack: (skillsOf.all(r.id, 'stack') as any[]).map((s) => s.name),
      contexte: sectionsOf.all(r.id, 'contexte') as Section[],
      processus: sectionsOf.all(r.id, 'processus') as Section[],
      galerie: galleryOf.all(r.id) as { src: string; alt: string }[],
    }));

    cache = {
      projects,
      // Filtres « Skills » : uniquement les compétences utilisées (carte OU fiche) par au moins un projet publié
      skills: (db.prepare(
        `SELECT s.name FROM skills s
          WHERE s.filterable = 1 AND EXISTS (
            SELECT 1 FROM project_skills ps JOIN projects p ON p.id = ps.project_id
             WHERE ps.skill_id = s.id AND p.published = 1)
          ORDER BY s.position`,
      ).all() as any[]).map((s) => s.name),
      contexts: db.prepare('SELECT id, label FROM contexts ORDER BY position').all() as { id: string; label: string }[],
    };
    return cache;
  } finally {
    db.close();
  }
}

export const getProjects = () => load().projects;
export const getSkills = () => load().skills;
export const getContexts = () => load().contexts;
