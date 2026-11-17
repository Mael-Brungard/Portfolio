/**
 * Script commun à toutes les pages.
 * - Dans l'écran 3D (iframe) : informe la scène de la page affichée et relaie la touche Échap.
 * - Bouton « Retour » : revient en arrière si on vient du site, sinon à l'accueil.
 */
const embedded = window.self !== window.top;

if (embedded) {
  const send = (type: string, extra: object = {}) => parent.postMessage({ type, ...extra }, location.origin);
  send('portfolio:navigate', { path: location.pathname, title: document.title });
  addEventListener('keydown', (e) => e.key === 'Escape' && send('portfolio:exit'));
}

document.querySelectorAll<HTMLAnchorElement>('[data-back]').forEach((a) =>
  a.addEventListener('click', (e) => {
    if (document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
  }),
);
