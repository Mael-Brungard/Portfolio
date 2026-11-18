Déclaration d'usage de l'IA

Textes du site : rédigés par moi (maquette Figma), avec quelques modifications apportées suite aux commentaires de la soutenance maquette. Les textes des fiches projets ont ensuite été relus avec l'IA (Claude) pour l'orthographe et la formulation, et le passage « Mes forces » de la page À propos a été reformulé avec elle. J'ai validé chaque modification.
Scène 3D : réalisée par Claude en s'inspirant de mon univers graphique et de mes idées. J'ai modifié la scène pour y ajouter manuellement mon logo.

Ce que je maîtrise et peux défendre à l'oral
Architecture : pages Astro réelles affichées dans une iframe projetée sur l'écran 3D (CSS3DRenderer).
Trou dans le canvas WebGL (NoBlending) pour laisser voir l'écran HTML derrière.
Animation caméra (GSAP) : rig.pos, rig.look, FOV.
Communication iframe ↔ scène (postMessage).
Base SQLite lue au build (src/lib/db.ts) et admin local (admin/server.mjs).
Fallback sans 3D (mobile, pas de WebGL) = version 2D de la maquette.
