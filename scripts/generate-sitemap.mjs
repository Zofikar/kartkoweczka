import { writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';

const mode = process.env.NODE_ENV || 'production';
const env = loadEnv(mode, process.cwd(), '');
const origin = env.VITE_ORIGIN;
const basePath = env.VITE_BASE_PATH || '';
const schema = env.VITE_SCHEMA || 'http';
const siteUrl = schema + '://' + origin + basePath;

import { isDynamic, routes } from '../src/routes.js';

const urls = routes
	.filter((route) => !isDynamic(route) && !route.debug)
	.map((route) => `${siteUrl}${route.path}`);

urls.push(`${siteUrl}/licenses.html`);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
	.map(
		(url) => `  <url>
    <loc>${url}</loc>
  </url>`
	)
	.join('\n')}
</urlset>
`;

await writeFile('public/sitemap.xml', xml, 'utf8');

console.log(`Generated sitemap with ${urls.length} URLs`);

const robots = `User-agent: *
Allow: /
Disallow: /debug/

Sitemap: ${siteUrl}/sitemap.xml
`;

await writeFile('public/robots.txt', robots, 'utf8');
