-- Schéma de la base des projets (SQLite). Source de vérité : db/portfolio.sqlite
PRAGMA foreign_keys = ON;

CREATE TABLE contexts (
  id         TEXT PRIMARY KEY,           -- perso | pro | mmi1 | mmi2
  label      TEXT NOT NULL,              -- court : filtre (« MMI 1 »)
  long_label TEXT NOT NULL,              -- affiché sur les cartes (« MMI - 1re année »)
  position   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE skills (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  filterable INTEGER NOT NULL DEFAULT 1, -- 1 = proposé dans les filtres de la page Projets
  position   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE projects (
  id         INTEGER PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,       -- /projets/<slug>
  title      TEXT NOT NULL,
  logo       TEXT NOT NULL,              -- chemin dans /public
  context_id TEXT NOT NULL REFERENCES contexts(id),
  grp        TEXT NOT NULL CHECK (grp IN ('scolaire', 'perso-pro')),
  summary    TEXT NOT NULL,              -- **gras** autorisé
  position   INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 1  -- 0 = brouillon (non généré)
);

-- kind = 'tag'   : étiquettes de la carte (3 max conseillé)
-- kind = 'stack' : technologies affichées en haut de la fiche projet
CREATE TABLE project_skills (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill_id   INTEGER NOT NULL REFERENCES skills(id),
  kind       TEXT NOT NULL CHECK (kind IN ('tag', 'stack')),
  position   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, skill_id, kind)
);

CREATE TABLE sections (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tab        TEXT NOT NULL CHECK (tab IN ('contexte', 'processus')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,              -- **gras** autorisé, \n = saut de ligne
  position   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE gallery (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  src        TEXT NOT NULL,
  alt        TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sections_project ON sections(project_id, tab, position);
CREATE INDEX idx_gallery_project ON gallery(project_id, position);
