/** Onglets accessibles (rôles ARIA, flèches clavier, ancre #id dans l'URL). */
document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((root) => {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[role=tabpanel]')];

  const show = (id: string, focus = false) => {
    tabs.forEach((t) => {
      const on = t.dataset.tab === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach((p) => (p.hidden = p.dataset.panel !== id));
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t.dataset.tab!));
    t.addEventListener('keydown', (e) => {
      const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
      if (next >= 0) { e.preventDefault(); show(tabs[(next + tabs.length) % tabs.length].dataset.tab!, true); }
    });
  });

  const fromHash = () => { const id = location.hash.slice(1); if (tabs.some((t) => t.dataset.tab === id)) show(id); };
  addEventListener('hashchange', fromHash);
  fromHash();
});
