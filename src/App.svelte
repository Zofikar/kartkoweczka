<script lang="ts">
	import { Router } from 'sv-router';
	import './router';
	import { isRunningAsPWA } from './utils/pwaCheck';
	import { onMount } from 'svelte';
	import Nav from './lib/components/Nav.svelte';
	import Footer from './lib/components/Footer.svelte';
	import Sidebar from './lib/components/Sidebar.svelte';
	import LockScreen from './lib/components/LockScreen.svelte';
	import Snackbar from './lib/ui/Snackbar.svelte';
	import { routes } from './router';
	import { initializeDatabase } from '@/db/client';

	interface BeforeInstallPromptEvent extends Event {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let isPWA = $state(isRunningAsPWA());
	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
	let isLight = $state(false);
	let sidebarOpen = $state(false);

	onMount(async () => {
		try {
			const stored = localStorage.getItem('theme');
			if (stored === 'light') {
				isLight = true;
				document.documentElement.setAttribute('data-theme', 'light');
			}
		} catch {
			// localStorage not available, default to dark
		}

		window.addEventListener('beforeinstallprompt', (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
		});

		await initializeDatabase();
	});

	function toggleTheme() {
		isLight = !isLight;
		document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
		try {
			localStorage.setItem('theme', isLight ? 'light' : 'dark');
		} catch {
			// localStorage not available
		}
	}

	async function handleInstall() {
		if (!deferredPrompt) return;

		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;

		if (outcome === 'accepted') {
			isPWA = true;
		}
		deferredPrompt = null;
	}
</script>

<Nav
	brandName="Kartkówka"
	{isLight}
	ontoggletheme={toggleTheme}
	onmenutoggle={() => (sidebarOpen = !sidebarOpen)}
/>
<div id="main-container">
	<Sidebar pages={routes} mobileOpen={sidebarOpen} onclose={() => (sidebarOpen = false)} />
	<main>
		{#if isPWA}
			<Router />
		{:else}
			<LockScreen deferredPrompt={!!deferredPrompt} oninstall={handleInstall} />
		{/if}
	</main>
</div>
<Footer />
<Snackbar />
