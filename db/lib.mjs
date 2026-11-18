// Outils partagés par l'admin et les scripts : ouverture de la base + export en db/seed.sql.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const DB_FILE = 'db/portfolio.sqlite';

export function openDb() {
  const fresh = !existsSync(DB_FILE);
  const db = new DatabaseSync(DB_FILE);
  if (fresh) { db.exec(readFileSync('db/schema.sql', 'utf8')); db.exec(readFileSync('db/seed.sql', 'utf8')); }
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

/** Exporte toute la base en INSERT lisibles : db/seed.sql reste identique à la base (et versionnable avec Git). */
export function dumpSeed(db) {
  const tables = [
    ['contexts', 'id, label, long_label, position', 'position'],
    ['skills', 'id, name, filterable, position', 'id'],
    ['projects', 'id, slug, title, logo, context_id, grp, summary, position, published', 'position, id'],
    ['project_skills', 'project_id, skill_id, kind, position', 'project_id, kind, position'],
    ['sections', 'id, project_id, tab, title, body, position', 'project_id, tab, position'],
    ['gallery', 'id, project_id, src, alt, position', 'project_id, position'],
  ];
  const out = ['-- Export automatique de db/portfolio.sqlite (bun run admin / bun run db:dump). Recréer la base : bun run db:seed', 'PRAGMA foreign_keys = ON;', ''];
  for (const [t, cols, order] of tables) {
    for (const row of db.prepare(`SELECT ${cols} FROM ${t} ORDER BY ${order}`).all())
      out.push(`INSERT INTO ${t}(${cols}) VALUES (${Object.values(row).map(q).join(', ')});`);
    out.push('');
  }
  writeFileSync('db/seed.sql', out.join('\n'));
}
