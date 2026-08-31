// Stages exactly the public files for deployment into dist/.
// Run via `npm run stage` (called automatically by `npm run deploy`).
import { rmSync, mkdirSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const items = ['index.html', 'about.html', 'privacy.html', 'robots.txt', 'sitemap.xml', 'assets'];

for (const item of items) {
  const src = path.join(root, item);
  const dest = path.join(dist, item);
  cpSync(src, dest, { recursive: true });
  console.log(`copied ${item}`);
}
