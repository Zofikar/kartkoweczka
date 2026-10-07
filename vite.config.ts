import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import zodCompiler from 'zod-compiler/vite';
import path from 'path';
import { resolveVersion } from './scripts/version.mjs';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const databaseBackend = env.DATABASE_BACKEND === 'tauri' ? 'tauri' : 'browser';
	const version = resolveVersion();

	return {
		base: env.VITE_BASE_PATH || './',
		define: {
			__APP_VERSION__: JSON.stringify(version.displayVersion),
			__APP_COMMIT__: JSON.stringify(version.commit),
			__DATABASE_BACKEND__: JSON.stringify(databaseBackend),
		},
		resolve: {
			alias: {
				'@': path.resolve(import.meta.dirname, './src/'),
				$lib: path.resolve(import.meta.dirname, './src/lib'),
			},
		},
		plugins: [
			{
				name: 'git-build-version',
				generateBundle() {
					this.emitFile({
						type: 'asset',
						fileName: 'version.json',
						source: JSON.stringify(version),
					});
				},
			},
			svelte(),
			VitePWA({
				// Tauri bundles its assets locally and must not install a PWA worker.
				disable: databaseBackend === 'tauri',
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
							src: 'icon-192x192.png',
							sizes: '192x192',
							type: 'image/png',
						},
						{
							src: 'icon-512x512.png',
							sizes: '512x512',
							type: 'image/png',
						},
					],
					theme_color: '#ffffff',
					background_color: '#ffffff',
					display: 'standalone',
				},
				workbox: {
					navigateFallback: 'index.html',
					globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,wasm,data,woff2}', 'version.json'],
					// The bundled license report is ~19 MB and must remain available offline.
					maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
				},
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
		server: {
			watch: {
				ignored: ['**/src-tauri/**'],
			},
		},
	};
});
