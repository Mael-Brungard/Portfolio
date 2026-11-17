/**
 * Script commun à toutes les pages.
 *  1. Écran 3D : informe la scène de la page affichée et relaie la touche Échap (postMessage).
 *  2. Animation entre pages : rideau doré (CSS) + petit délai avant de naviguer.
 *  3. Hauteur d'en-tête (--header-h) et barre d'ancres interactive (scroll-spy + clic).
 */
const root = document.documentElement;
const embedded = window.self !== window.top;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 1 ─ dialogue avec la scène 3D */
if (embedded) {
  const send = (type: string, extra: object = {}) => parent.postMessage({ type, ...extra }, location.origin);
  send('portfolio:navigate', { path: location.pathname, title: document.title });
  addEventListener('keydown', (e) => e.key === 'Escape' && send('portfolio:exit'));
}

/* 2 ─ transition de sortie */
const leave = (go: () => void) => {
  if (reduced) return go();
  root.classList.add('leaving');
  setTimeout(go, 380);
};
addEventListener('pageshow', (e) => e.persisted && root.classList.remove('leaving')); // retour via le cache navigateur

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin) return; // externe, mailto, tel…
  if (url.pathname === location.pathname && url.search === location.search) return; // simple ancre : pas de transition
  e.preventDefault();
  leave(() => (location.href = url.href));
});

/* 3b ─ hauteur de l'en-tête sticky (pour coller la barre d'ancres dessous) */
const header = document.querySelector('header');
if (header) {
  const setH = () => root.style.setProperty('--header-h', `${header.offsetHeight}px`);
  new ResizeObserver(setH).observe(header);
  setH();
}

/* 3c ─ barre d'ancres : état actif mis à jour au scroll ET au clic, indicateur qui coulisse */
document.querySelectorAll<HTMLElement>('[data-spy]').forEach((nav) => {
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[data-target]')];
  const sections = links.map((l) => document.getElementById(l.dataset.target!)).filter(Boolean) as HTMLElement[];
  const indicator = nav.querySelector<HTMLElement>('[data-indicator]')!;
  let current = '';
  let locked = false; // vrai pendant le défilement déclenché par un clic (évite que l'actif « clignote » en route)
  let timer = 0;

  const place = (animate: boolean) => {
    const cur = links.find((l) => l.dataset.target === current);
    if (!cur) return;
    indicator.style.width = `${cur.offsetWidth}px`;
    indicator.style.height = `${cur.offsetHeight}px`;
    indicator.style.transform = `translate(${cur.offsetLeft}px, ${cur.offsetTop}px)`;
    indicator.classList.toggle('is-ready', animate);
    if (nav.scrollWidth > nav.clientWidth) // mobile : garde le lien actif visible dans la barre (sans faire défiler la page)
      nav.scrollTo({ left: cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
  };

  const set = (id: string, animate = true) => {
    if (id === current) return;
    current = id;
    links.forEach((l) => (l.dataset.target === id ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
    sections.forEach((s) => (s.id === id ? s.setAttribute('data-active', '') : s.removeAttribute('data-active')));
    place(animate);
  };

  // Section active = la dernière dont le haut est passé sous la ligne « en-tête + barre d'ancres »
  const compute = () => {
    const line = (header?.offsetHeight ?? 0) + nav.offsetHeight + 48;
    let active = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top <= line) active = s;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) active = sections[sections.length - 1];
    set(active.id);
  };

  const unlockSoon = () => { clearTimeout(timer); timer = window.setTimeout(() => { locked = false; compute(); }, 140); };

  addEventListener('scroll', () => { if (locked) unlockSoon(); else requestAnimationFrame(compute); }, { passive: true });

  links.forEach((l) => l.addEventListener('click', () => {
    set(l.dataset.target!); // retour visuel immédiat, sans attendre la fin du défilement
    locked = true;
    unlockSoon();           // si la page ne bouge pas (déjà en place), on déverrouille quand même
  }));

  new ResizeObserver(() => place(false)).observe(nav);
  nav.setAttribute('data-ind', '');
  const fromHash = sections.find((s) => '#' + s.id === location.hash);
  set((fromHash ?? sections[0]).id, false);
  place(false);
  requestAnimationFrame(() => compute()); // si la page est rechargée en milieu de scroll
});
