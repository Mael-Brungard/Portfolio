// npm run db:seed → recrée db/portfolio.sqlite depuis schema.sql + seed.sql
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, rmSync } from 'node:fs';

rmSync('db/portfolio.sqlite', { force: true });
const db = new DatabaseSync('db/portfolio.sqlite');
db.exec(readFileSync('db/schema.sql', 'utf8'));
db.exec(readFileSync('db/seed.sql', 'utf8'));
const n = db.prepare('SELECT COUNT(*) AS n FROM projects').get().n;
console.log(`✔ db/portfolio.sqlite recréée (${n} projets)`);
db.close();
