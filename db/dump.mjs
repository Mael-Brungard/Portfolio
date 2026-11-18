// bun run db:dump → réécrit db/seed.sql à partir de la base (à lancer si tu as modifié la base avec un autre outil)
import { openDb, dumpSeed } from './lib.mjs';
const db = openDb(); dumpSeed(db); db.close();
console.log('✔ db/seed.sql mis à jour depuis db/portfolio.sqlite');
