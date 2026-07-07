// @ts-check
import { defineConfig } from 'astro/config';

// h11t labs — static brand + writing site.
// Output is plain static files (dist/), deployable to any host.
export default defineConfig({
  site: 'https://h11t-labs.nl',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  markdown: {
    // Dual syntax themes: every token carries both a light and a dark colour as
    // CSS variables (--shiki-light / --shiki-dark), and global.css picks the one
    // that matches the active site theme. `defaultColor: false` means no colour
    // is baked in, so the switch is purely CSS.
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      wrap: false,
    },
  },
});
