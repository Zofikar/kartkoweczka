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
	import NativeUpdater from './lib/components/NativeUpdater.svelte';
	import { i18n } from './lib/i18n.svelte';

	interface BeforeInstallPromptEvent extends Event {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let isPWA = $state(isRunningAsPWA());
	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
	let isLight = $state(false);
	let sidebarOpen = $state(false);

	onMount(() => {
		i18n.initialize();
		try {
			const stored = localStorage.getItem('theme');
			if (stored === 'light') {
				isLight = true;
				document.documentElement.setAttribute('data-theme', 'light');
			}
		} catch {
			// localStorage not available, default to dark
		}

		if (isPWA) {
			import('@/db/client').then(({ initializeDatabase }) => initializeDatabase());
		}

		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		};
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
		deferredPrompt = null;
	}
</script>

<Nav
	brandName="Kartkówka"
	{isLight}
	locale={i18n.locale}
	onlocalechange={(locale) => i18n.setLocale(locale)}
	ontoggletheme={toggleTheme}
	onmenutoggle={() => (sidebarOpen = !sidebarOpen)}
/>
<div id="main-container">
	<Sidebar mobileOpen={sidebarOpen} onclose={() => (sidebarOpen = false)} />
	<main>
		{#if __DATABASE_BACKEND__ === 'tauri' && !/Android|iPhone|iPad/i.test(navigator.userAgent)}
			<NativeUpdater />
		{/if}
		{#if isPWA}
			<Router />
		{:else}
			<LockScreen deferredPrompt={!!deferredPrompt} oninstall={handleInstall} />
		{/if}
	</main>
</div>
<Footer />
<Snackbar />
