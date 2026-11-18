// Admin LOCAL des projets : bun run admin → http://localhost:4400
// Aucune dépendance : serveur Node + SQLite intégré. Écoute uniquement sur 127.0.0.1 (ta machine).
// Chaque enregistrement met à jour db/portfolio.sqlite ET db/seed.sql (versionnable avec Git).
import { createServer } from 'node:http';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { openDb, dumpSeed } from '../db/lib.mjs';

const PORT = 4400;
const db = openDb();
const IMG_DIR = join(process.cwd(), 'public', 'img');

/* ───────── utilitaires ───────── */
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const slugify = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const list = (s) => [...new Set((s || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))];

function images(dir = IMG_DIR, base = '/img') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? images(join(dir, e.name), `${base}/${e.name}`) : /\.(svg|png|jpe?g|webp|avif|gif)$/i.test(e.name) ? [`${base}/${e.name}`] : []);
}

// Format des sections dans les zones de texte :  "## Titre" puis le texte (**gras** autorisé)
const parseSections = (text) => {
  const out = []; let cur = null;
  for (const line of (text || '').replace(/\r/g, '').split('\n')) {
    const m = line.match(/^##\s*(.+)$/);
    if (m) { cur = { title: m[1].trim(), lines: [] }; out.push(cur); } else if (cur) cur.lines.push(line);
  }
  return out.map((s) => ({ title: s.title, body: s.lines.join('\n').trim() })).filter((s) => s.title && s.body);
};
const formatSections = (rows) => rows.map((r) => `## ${r.title}\n${r.body}`).join('\n\n');
const parseGallery = (text) => (text || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [src, ...alt] = l.split('|'); return { src: src.trim(), alt: alt.join('|').trim() }; });

/* ───────── lecture ───────── */
const contexts = () => db.prepare('SELECT id, long_label FROM contexts ORDER BY position').all();
const skillNames = () => db.prepare('SELECT name FROM skills ORDER BY position').all().map((s) => s.name);

function loadProject(id) {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!p) return null;
  const sk = (kind) => db.prepare('SELECT s.name FROM project_skills ps JOIN skills s ON s.id = ps.skill_id WHERE ps.project_id = ? AND ps.kind = ? ORDER BY ps.position').all(id, kind).map((s) => s.name).join(', ');
  const sec = (tab) => formatSections(db.prepare('SELECT title, body FROM sections WHERE project_id = ? AND tab = ? ORDER BY position').all(id, tab));
  const gal = db.prepare('SELECT src, alt FROM gallery WHERE project_id = ? ORDER BY position').all(id).map((g) => `${g.src} | ${g.alt}`).join('\n');
  return { id: p.id, title: p.title, slug: p.slug, logo: p.logo, context_id: p.context_id, grp: p.grp, summary: p.summary, published: p.published, tag: sk('tag'), stack: sk('stack'), contexte: sec('contexte'), processus: sec('processus'), galerie: gal };
}

/* ───────── écriture ───────── */
function save(f) {
  const title = (f.get('title') || '').trim();
  const summary = (f.get('summary') || '').trim();
  if (!title) throw new Error('Le titre est obligatoire.');
  if (!summary) throw new Error('Le résumé est obligatoire.');
  const slug = slugify(f.get('slug') || title);
  const id = Number(f.get('id')) || null;
  const dupe = db.prepare('SELECT id FROM projects WHERE slug = ?').get(slug);
  if (dupe && dupe.id !== id) throw new Error(`Le slug « ${slug} » est déjà utilisé par un autre projet.`);
  const ctx = f.get('context_id');
  if (!db.prepare('SELECT 1 FROM contexts WHERE id = ?').get(ctx)) throw new Error('Contexte inconnu.');
  const grp = f.get('grp') === 'scolaire' ? 'scolaire' : 'perso-pro';
  const logo = (f.get('logo') || '').trim() || `/img/${slug}.svg`;
  const published = f.get('published') === 'on' ? 1 : 0;

  let pid = id;
  db.exec('BEGIN');
  try {
    if (id) db.prepare('UPDATE projects SET slug=?, title=?, logo=?, context_id=?, grp=?, summary=?, published=? WHERE id=?').run(slug, title, logo, ctx, grp, summary, published, id);
    else {
      const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS n FROM projects').get().n;
      pid = Number(db.prepare('INSERT INTO projects(slug, title, logo, context_id, grp, summary, position, published) VALUES (?,?,?,?,?,?,?,?)').run(slug, title, logo, ctx, grp, summary, pos, published).lastInsertRowid);
    }

    db.prepare('DELETE FROM project_skills WHERE project_id = ?').run(pid);
    for (const kind of ['tag', 'stack']) {
      const seen = new Set();
      list(f.get(kind)).forEach((name) => {
        let s = db.prepare('SELECT id FROM skills WHERE name = ? COLLATE NOCASE').get(name);
        if (!s) { // technologie inconnue : créée automatiquement (et proposée dans les filtres)
          const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS n FROM skills').get().n;
          s = { id: Number(db.prepare('INSERT INTO skills(name, filterable, position) VALUES (?,1,?)').run(name, pos).lastInsertRowid) };
        }
        if (seen.has(s.id)) return; seen.add(s.id);
        db.prepare('INSERT INTO project_skills(project_id, skill_id, kind, position) VALUES (?,?,?,?)').run(pid, s.id, kind, seen.size);
      });
    }

    db.prepare('DELETE FROM sections WHERE project_id = ?').run(pid);
    for (const tab of ['contexte', 'processus'])
      parseSections(f.get(tab)).forEach((s, i) => db.prepare('INSERT INTO sections(project_id, tab, title, body, position) VALUES (?,?,?,?,?)').run(pid, tab, s.title, s.body, i + 1));

    db.prepare('DELETE FROM gallery WHERE project_id = ?').run(pid);
    parseGallery(f.get('galerie')).forEach((g, i) => db.prepare('INSERT INTO gallery(project_id, src, alt, position) VALUES (?,?,?,?)').run(pid, g.src, g.alt, i + 1));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  dumpSeed(db);
  return pid;
}

function action(f) {
  const id = Number(f.get('id'));
  const op = f.get('op');
  if (op === 'toggle') db.prepare('UPDATE projects SET published = 1 - published WHERE id = ?').run(id);
  else if (op === 'delete') db.prepare('DELETE FROM projects WHERE id = ?').run(id); // sections / galerie / skills liés : supprimés en cascade
  else if (op === 'up' || op === 'down') {
    const me = db.prepare('SELECT id, position FROM projects WHERE id = ?').get(id);
    const other = op === 'up'
      ? db.prepare('SELECT id, position FROM projects WHERE position < ? ORDER BY position DESC LIMIT 1').get(me.position)
      : db.prepare('SELECT id, position FROM projects WHERE position > ? ORDER BY position ASC LIMIT 1').get(me.position);
    if (other) { db.prepare('UPDATE projects SET position = ? WHERE id = ?').run(other.position, me.id); db.prepare('UPDATE projects SET position = ? WHERE id = ?').run(me.position, other.id); }
  }
  dumpSeed(db);
}

/* ───────── vues ───────── */
const page = (body, flash = '') => `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin projets</title>
<style>
  :root{color-scheme:dark;--g:#e6c280;--bg:#1f130b;--panel:#2a190d}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:#f2f1df;font:16px/1.5 system-ui,sans-serif;padding:24px;max-width:1100px;margin-inline:auto}
  h1{font-size:28px;margin:0 0 4px} h2{color:var(--g);margin:28px 0 8px;font-size:18px} a{color:var(--g)}
  .hint{color:#bdb59a;font-size:14px;margin:2px 0 8px} .flash{background:#2f4a2a;border:1px solid #6aa35a;padding:10px 14px;border-radius:8px;margin:12px 0}
  .error{background:#4a2020;border-color:#c55}
  table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid #5a4020} th,td{padding:8px 10px;border-bottom:1px solid #3b2a17;text-align:left;vertical-align:middle}
  img.logo{width:44px;height:44px;object-fit:contain}
  button,.btn{background:#3a2614;color:#f2f1df;border:1px solid var(--g);border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit;text-decoration:none;display:inline-block}
  button:hover,.btn:hover{background:#5a3d1c} .primary{background:var(--g);color:#1f130b;font-weight:700} .danger{border-color:#c55;color:#f99}
  form.inline{display:inline} label{display:block;font-weight:600;margin-top:16px}
  input[type=text],select,textarea{width:100%;background:#150c06;color:#f2f1df;border:1px solid #6b5230;border-radius:8px;padding:9px 12px;font:inherit}
  textarea{font-family:ui-monospace,Consolas,monospace;font-size:14px;min-height:130px} .row{display:grid;grid-template-columns:1fr 1fr;gap:16px} .off{opacity:.5}
  code{background:#150c06;padding:1px 5px;border-radius:4px} details{margin-top:8px;background:var(--panel);padding:8px 12px;border-radius:8px}
</style><body>${flash}${body}</body></html>`;

function viewList(flash = '') {
  const rows = db.prepare('SELECT p.*, c.long_label FROM projects p JOIN contexts c ON c.id = p.context_id ORDER BY p.position').all();
  return page(`
  <h1>Projets du portfolio</h1>
  <p class="hint">Base : <code>db/portfolio.sqlite</code>. Chaque enregistrement met aussi à jour <code>db/seed.sql</code>. Ensuite : <code>bun run dev</code> (aperçu) ou <code>bun run build</code>.</p>
  <p><a class="btn primary" href="/edit">+ Nouveau projet</a></p>
  <table><tr><th></th><th>Projet</th><th>Contexte</th><th>Ordre</th><th>Statut</th><th>Actions</th></tr>
  ${rows.map((p) => `<tr class="${p.published ? '' : 'off'}">
    <td><img class="logo" src="${esc(p.logo)}" alt=""></td>
    <td><b>${esc(p.title)}</b><br><span class="hint">/projets/${esc(p.slug)}</span></td><td>${esc(p.long_label)}</td>
    <td><form class="inline" method="post" action="/action"><input type="hidden" name="id" value="${p.id}"><button name="op" value="up" title="Monter">↑</button> <button name="op" value="down" title="Descendre">↓</button></form></td>
    <td>${p.published ? 'Publié' : 'Masqué'}</td>
    <td><a class="btn" href="/edit?id=${p.id}">Modifier</a>
      <form class="inline" method="post" action="/action"><input type="hidden" name="id" value="${p.id}"><button name="op" value="toggle">${p.published ? 'Masquer' : 'Publier'}</button>
      <button name="op" value="delete" class="danger" onclick="return confirm('Supprimer définitivement « ${esc(p.title).replace(/&#39;/g, "\\'")} » ?')">Supprimer</button></form></td></tr>`).join('')}
  </table>`, flash);
}

function viewForm(v, error = '') {
  const isNew = !v.id;
  const opts = (arr, sel, val = (x) => x, lab = (x) => x) => arr.map((x) => `<option value="${esc(val(x))}" ${val(x) === sel ? 'selected' : ''}>${esc(lab(x))}</option>`).join('');
  const imgs = images();
  return page(`
  <p><a href="/">← Tous les projets</a></p>
  <h1>${isNew ? 'Nouveau projet' : 'Modifier « ' + esc(v.title) + ' »'}</h1>
  <form method="post" action="/save">
    <input type="hidden" name="id" value="${v.id || ''}">
    <div class="row">
      <div><label>Titre *</label><input type="text" name="title" value="${esc(v.title)}" required></div>
      <div><label>Adresse (slug)</label><input type="text" name="slug" value="${esc(v.slug)}" placeholder="auto : déduite du titre"><div class="hint">→ /projets/<b>slug</b></div></div>
    </div>
    <div class="row">
      <div><label>Contexte *</label><select name="context_id">${opts(contexts(), v.context_id, (c) => c.id, (c) => c.long_label)}</select></div>
      <div><label>Rubrique de la page Projets *</label><select name="grp">${opts(['scolaire', 'perso-pro'], v.grp, (x) => x, (x) => (x === 'scolaire' ? 'Projets Scolaires' : 'Projets Personnels & Professionnels'))}</select></div>
    </div>
    <label>Logo / image de la carte</label>
    <input type="text" name="logo" value="${esc(v.logo)}" list="imgs" placeholder="/img/mon-projet.svg">
    <datalist id="imgs">${imgs.map((i) => `<option value="${esc(i)}">`).join('')}</datalist>
    <div class="hint">Copie d'abord le fichier dans <code>public/img/</code>, puis tape ou choisis son chemin (commence par <code>/img/</code>).</div>
    <label>Résumé *</label><textarea name="summary" style="min-height:90px" required>${esc(v.summary)}</textarea>
    <div class="hint">Mets <code>**les mots importants**</code> entre doubles astérisques : ils s'affichent en doré.</div>
    <div class="row">
      <div><label>Étiquettes de la carte</label><input type="text" name="tag" value="${esc(v.tag)}" list="skills"><div class="hint">3 conseillées, séparées par des virgules.</div></div>
      <div><label>Technologies de la fiche</label><input type="text" name="stack" value="${esc(v.stack)}" list="skills"><div class="hint">Une technologie inconnue est créée automatiquement.</div></div>
    </div>
    <datalist id="skills">${skillNames().map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
    <label>Section « Contexte »</label><textarea name="contexte">${esc(v.contexte)}</textarea>
    <label>Section « Processus »</label><textarea name="processus">${esc(v.processus)}</textarea>
    <div class="hint">Format : une ligne <code>## Titre</code>, puis le texte dessous. Répète pour chaque bloc. Les doubles astérisques mettent en doré.</div>
    <label>Galerie</label><textarea name="galerie" placeholder="/img/mon-projet/image1.webp | Description de l'image">${esc(v.galerie)}</textarea>
    <div class="hint">Une image par ligne : <code>chemin | texte alternatif</code> (obligatoire pour l'accessibilité).</div>
    <details><summary>Images disponibles dans public/img (${imgs.length})</summary><pre>${esc(imgs.join('\n'))}</pre></details>
    <label><input type="checkbox" name="published" ${v.published ? 'checked' : ''}> Publié (décoche pour garder en brouillon)</label>
    <p><button class="primary" type="submit">Enregistrer</button> <a class="btn" href="/">Annuler</a></p>
  </form>`, error ? `<div class="flash error">${esc(error)}</div>` : '');
}

const emptyProject = { id: '', title: '', slug: '', logo: '', context_id: 'perso', grp: 'perso-pro', summary: '', published: 1, tag: '', stack: '', contexte: '## Le projet\n\n\n## Mon rôle\n', processus: '## Recherches et pistes\n\n\n## Choix techniques\n\n\n## Résultat\n', galerie: '' };

/* ───────── serveur ───────── */
const body = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(new URLSearchParams(d))); });
const send = (res, html, code = 200) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); };
const redirect = (res, to) => { res.writeHead(303, { Location: to }); res.end(); };
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif' };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname.startsWith('/img/')) { // aperçu des logos
      const file = normalize(join(IMG_DIR, url.pathname.slice(5)));
      if (!file.startsWith(IMG_DIR) || !existsSync(file) || !statSync(file).isFile()) return send(res, 'Introuvable', 404);
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
      return res.end(readFileSync(file));
    }
    if (req.method === 'GET' && url.pathname === '/') return send(res, viewList(url.searchParams.get('ok') ? `<div class="flash">✔ ${esc(url.searchParams.get('ok'))}</div>` : ''));
    if (req.method === 'GET' && url.pathname === '/edit') {
      const id = Number(url.searchParams.get('id'));
      const p = id ? loadProject(id) : emptyProject;
      return p ? send(res, viewForm(p)) : send(res, 'Projet introuvable', 404);
    }
    if (req.method === 'POST' && url.pathname === '/save') {
      const f = await body(req);
      try { save(f); return redirect(res, '/?ok=' + encodeURIComponent('Projet enregistré. Relance « bun run build » pour publier.')); }
      catch (e) { const v = Object.fromEntries(f); return send(res, viewForm({ ...emptyProject, ...v, published: v.published === 'on' ? 1 : 0 }, e.message), 400); }
    }
    if (req.method === 'POST' && url.pathname === '/action') { action(await body(req)); return redirect(res, '/?ok=' + encodeURIComponent('Modification enregistrée.')); }
    send(res, 'Introuvable', 404);
  } catch (e) { send(res, `<pre>${esc(e.stack)}</pre>`, 500); }
}).listen(PORT, '127.0.0.1', () => console.log(`✔ Admin des projets : http://localhost:${PORT}  (Ctrl+C pour quitter)`));
