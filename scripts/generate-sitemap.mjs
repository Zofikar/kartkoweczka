import { writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';

const mode = process.env.NODE_ENV || 'production';
const env = loadEnv(mode, process.cwd(), '');
const origin = env.VITE_ORIGIN;
const schema = env.VITE_SCHEMA || 'http';
const siteUrl = schema + '://' + origin;

const urls = [`${siteUrl}/`, `${siteUrl}/licenses.html`];

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
