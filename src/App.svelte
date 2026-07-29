<script lang="ts">
	import { Router, Route } from 'svelte-navigator';
	import { isRunningAsPWA } from './utils/pwaCheck';
	import { onMount } from 'svelte';
	import Nav from './lib/components/Nav.svelte';
	import Footer from './lib/components/Footer.svelte';
	import Sidebar from './lib/components/Sidebar.svelte';
	import LockScreen from './lib/components/LockScreen.svelte';
	import HomePage from './pages/home/page.svelte';

	interface BeforeInstallPromptEvent extends Event {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	interface PageEntry {
		id: string;
		label: string;
		path: string;
		component: Function;
	}

	let isPWA = $state(import.meta.env.DEV || isRunningAsPWA());
	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
	let isLight = $state(false);
	let sidebarOpen = $state(false);

	const pages: PageEntry[] = [
		{ id: 'home', label: 'Strona główna', path: '/', component: HomePage },
	];

	onMount(() => {
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

<Router basepath={import.meta.env.BASE_URL}>
	<Nav
		brandName="Kartkówka"
		{isLight}
		ontoggletheme={toggleTheme}
		onmenutoggle={() => (sidebarOpen = !sidebarOpen)}
	/>
	<div id="main-container">
		<Sidebar {pages} mobileOpen={sidebarOpen} onclose={() => (sidebarOpen = false)} />
		<main>
			{#if isPWA}
				{#each pages as page}
					<Route path={page.path} component={page.component} />
				{/each}
			{:else}
				<LockScreen deferredPrompt={!!deferredPrompt} oninstall={handleInstall} />
			{/if}
		</main>
	</div>
	<Footer />
</Router>
