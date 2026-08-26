import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { githubPagesSpa } from '@sctg/vite-plugin-github-pages-spa';
import zodCompiler from 'zod-compiler/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const base = env.VITE_BASE_PATH || '/';
	const normalizedBase = base.endsWith('/') ? base : `${base}/`;

	return {
		base,
		resolve: {
			alias: {
				'@': path.resolve(import.meta.dirname, './src/'),
				$lib: path.resolve(import.meta.dirname, './src/lib'),
			},
		},
		plugins: [
			svelte(),
			VitePWA({
				registerType: 'autoUpdate',
				injectRegister: 'auto',
				includeAssets: ['favicon.ico', 'robots.txt', 'icon-192x192.png', 'icon-512x512.png'],
				manifest: {
					name: 'Kartkóweczka',
					short_name: 'Kartkóweczka',
					description:
						'Aplikacja do generowania i sprawdzania testów jedno lub wielokrotnego wyboru',
					lang: 'pl',
					icons: [
						{
							src: `${normalizedBase}icon-192x192.png`,
							sizes: '192x192',
							type: 'image/png',
						},
						{
							src: `${normalizedBase}icon-512x512.png`,
							sizes: '512x512',
							type: 'image/png',
						},
					],
					theme_color: '#ffffff',
					background_color: '#ffffff',
					display: 'standalone',
				},
				workbox: {
					navigateFallback: `${normalizedBase}index.html`,
					globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,wasm,data,woff2}'],
					maximumFileSizeToCacheInBytes: 11 * 1024 * 1024,
				},
			}),
			githubPagesSpa({
				verbose: true,
				injectScript: true,
			}),
			zodCompiler(),
		],
		optimizeDeps: { exclude: ['svelte-navigator', '@sqlite.org/sqlite-wasm'] },
		build: {
			sourcemap: true,
			rolldownOptions: {
				output: {
					codeSplitting: true,
				},
			},
		},
		css: {
			devSourcemap: true,
		},
		preview: {
			allowedHosts: ['kartkoweczka.internal'],
		},
	};
});
