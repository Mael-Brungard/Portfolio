import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Domaine de production (URL canonique, OpenGraph, JSON-LD)
export default defineConfig({
  site: 'https://portfolio.taverne-etudiante.fr',
  vite: { plugins: [tailwindcss()] },
});
