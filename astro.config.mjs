import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// ⚠️ Remplace par TON nom de domaine (utilisé pour le canonical, le sitemap, l'OpenGraph)
export default defineConfig({
  site: 'https://mael-brungard.fr',
  vite: { plugins: [tailwindcss()] },
});
