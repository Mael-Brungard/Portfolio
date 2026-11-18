Journal de bord

Semaines 1 et 2, du 26 octobre au 1er novembre : mise en place
Choix de la stack : Astro + Tailwind pour un site statique léger, Three.js pour la scène 3D.
Squelette du projet généré avec l'IA (Claude) puis relu : pages Accueil, Projets, À propos, Contact, 404, mentions légales (29–30 oct.).
Idée principale : un bureau en 3D dont l'écran affiche le vrai site (iframe projetée en CSS3D derrière un « trou » dans le canvas WebGL).
Création de la base SQLite des projets (db/schema.sql) et de l'admin local pour les gérer sans toucher au code.
Décision : une version 2D complète pour le mobile et les navigateurs sans WebGL (la 3D ne doit jamais être obligatoire).

Semaines 3 et 4, du 16 au 22 novembre : finitions, animations, sobriété
Optimisation de la scène 3D : ombres calculées une seule fois, rendu suspendu quand on est zoomé sur l'écran (la page dans l'écran redevient fluide), poussière masquée pendant le zoom.
Texte flou dans l'écran 3D : la page de 1920 px était réduite à l'affichage. Une première tentative (passer l'écran en 2D) cassait le scroll, abandonnée. Solution retenue : dimensionner l'iframe à sa taille réelle une fois zoomée.
Fond rayé animé comme sur la maquette : lignes qui partent des coins, fixées à l'écran, fondu sans coupure. Panneaux sombres avec un léger flou d'arrière-plan.
Page Projets : filtres qui prennent en compte toutes les technologies (le filtre « Bootstrap » ne trouvait rien), animation de filtrage (glissement, sortie, entrée en cascade), sticker « Mis en avant » pour les projets avec galerie.
Fiches projet : galerie en carrousel avec flèches, rubrique masquée s'il n'y a pas d'images, bouton Retour vers la liste qui reste visible au défilement.
Textes : relecture des 7 projets (orthographe, formulations, mots-clés en doré) faite avec l'IA, puis validée par moi. Passage « Mes forces » reformulé : l'IA comme outil, pas comme adversaire.
Sobriété : images converties en WebP (18 Mo ramenés à 1 Mo), polices réduites au jeu latin, EcoIndex A sur toutes les pages (estimation avec la formule d'ecoindex.fr). Passage du projet sur Bun uniquement, nettoyage du code mort.
Bug découvert : le menu mobile était coincé dans l'en-tête à cause de son flou (backdrop-filter), sorti de l'en-tête.
