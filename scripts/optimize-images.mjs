// bun run images → convertit les images de public/img en WebP légères, puis met à jour la base (logos + galeries).
//
//  - PNG / JPG → WebP redimensionné à la taille utile (galerie : 900 px de haut max ≈ 26rem × écran Retina) ;
//  - logos SVG qui ne contiennent en réalité qu'une image bitmap (data:image/...) → WebP 400 × 400 (affichés en 200 px) ;
//  - les SVG vraiment vectoriels (légers) sont gardés tels quels ;
//  - les originaux sont DÉPLACÉS dans images-sources/ (ignoré par Git, non publié) : rien n'est perdu.
// Relançable sans risque : ce qui est déjà en WebP est ignoré. À relancer après avoir ajouté de nouvelles images.
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join, dirname, relative, extname, sep } from 'node:path';
import { openDb, dumpSeed } from '../db/lib.mjs';

const ROOT = 'public/img';
const BACKUP = 'images-sources';
const GALLERY = { width: 1400, height: 900, quality: 78 };
const LOGO = { size: 400, quality: 82 };

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const url = (file) => '/' + relative('public', file).split(sep).join('/');
const kb = (n) => `${Math.round(n / 1024)} Ko`;

const isRasterSvg = (file) => /data:image\/(png|jpe?g|webp)/.test(readFileSync(file, 'utf8'));

const renamed = []; // [ancienne URL, nouvelle URL]
let before = 0, after = 0;

for (const file of walk(ROOT)) {
  const ext = extname(file).toLowerCase();
  const isLogo = dirname(file) === ROOT; // fichiers à la racine de public/img = logos des projets
  let pipeline, quality;
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    const { width = 0, height = 0 } = await sharp(file).metadata();
    const [W, H] = isLogo ? [LOGO.size, LOGO.size] : [GALLERY.width, GALLERY.height];
    // à peine plus grande que la cible : on ne redimensionne pas (le rééchantillonnage alourdit les dessins à aplats)
    pipeline = width <= W * 1.15 && height <= H * 1.15 ? sharp(file) : sharp(file).resize(W, H, { fit: 'inside' });
    quality = isLogo ? LOGO.quality : GALLERY.quality;
  } else if (ext === '.svg' && isRasterSvg(file)) {
    pipeline = sharp(file, { density: 300 }).resize(LOGO.size, LOGO.size, { fit: 'inside' });
    quality = LOGO.quality;
  } else continue;

  const out = file.slice(0, -ext.length) + '.webp';
  if (existsSync(out)) { console.log(`• déjà converti : ${url(out)}`); continue; }
  // Photos : le WebP compressé gagne ; dessins à aplats de couleur : le WebP sans perte est souvent plus léger → on garde le plus petit
  const candidates = await Promise.all([
    pipeline.clone().webp({ quality, effort: 6 }).toBuffer(),
    pipeline.clone().webp({ lossless: true, effort: 6 }).toBuffer(),
    pipeline.clone().webp({ nearLossless: true, quality: 60, effort: 6 }).toBuffer(),
  ]);
  writeFileSync(out, candidates.reduce((a, b) => (b.length < a.length ? b : a)));

  const s0 = statSync(file).size, s1 = statSync(out).size;
  before += s0; after += s1;
  console.log(`✔ ${url(file)} (${kb(s0)}) → ${url(out)} (${kb(s1)})`);

  const backup = join(BACKUP, relative(ROOT, file));
  mkdirSync(dirname(backup), { recursive: true });
  renameSync(file, backup);
  renamed.push([url(file), url(out)]);
}

if (renamed.length) {
  const db = openDb();
  const upLogo = db.prepare('UPDATE projects SET logo = ? WHERE logo = ?');
  const upGal = db.prepare('UPDATE gallery SET src = ? WHERE src = ?');
  for (const [from, to] of renamed) { upLogo.run(to, from); upGal.run(to, from); }
  dumpSeed(db);
  db.close();
  console.log(`\n${renamed.length} image(s) : ${kb(before)} → ${kb(after)}. Base et db/seed.sql mises à jour, originaux dans ${BACKUP}/.`);
} else console.log('Rien à convertir.');
