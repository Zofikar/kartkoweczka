import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { githubPagesSpa } from '@sctg/vite-plugin-github-pages-spa';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	return {
		base: env.VITE_BASE_PATH,
		plugins: [
			svelte(),
			VitePWA({
				registerType: 'autoUpdate',
				injectRegister: 'auto',
				includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
				manifest: {
					name: 'Kartkóweczka',
					short_name: 'Kartkóweczka',
					description:
						'Aplikacja do generowania i sprawdzania testów jedno lub wielokrotnego wyboru',
					icons: [
						{
							src: '/icon-192x192.png',
							sizes: '192x192',
							type: 'image/png',
						},
						{
							src: '/icon-512x512.png',
							sizes: '512x512',
							type: 'image/png',
						},
					],
					theme_color: '#ffffff',
					background_color: '#ffffff',
					display: 'standalone',
				},
				workbox: {
					navigateFallback: '/index.html',
					globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
				},
			}),
			githubPagesSpa({
				verbose: true,
				injectScript: true,
			}),
		],
		optimizeDeps: { exclude: ['svelte-navigator'] },
	};
});
