<script lang="ts">
	import { i18n } from '../i18n.svelte';

	async function openLicenses(event: MouseEvent) {
		if (__DATABASE_BACKEND__ !== 'tauri') return;
		event.preventDefault();
		try {
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('open_licenses');
		} catch (error) {
			console.error('Failed to open licenses window:', error);
		}
	}
	interface Props {
		copyrightYear?: number;
		copyrightHolder?: string;
		class?: never;
		[k: string]: unknown;
	}

	let {
		copyrightYear = new Date().getFullYear(),
		copyrightHolder = 'Pawel Chwalczyk',

		...restProps
	}: Props = $props();
</script>

<footer class="primary footer-bar" {...restProps}>
	<span class="footer-text">
		Copyright &copy; {copyrightYear}
		{copyrightHolder}
	</span>
	<a
		href="{import.meta.env.BASE_URL}{import.meta.env.BASE_URL.endsWith('/')
			? ''
			: '/'}licenses.html"
		class="footer-link"
		onclick={openLicenses}
		target="_blank"
		rel="noopener">{i18n.t('footer.licenses')}</a
	>
</footer>

<style>
	.footer-bar {
		min-height: 64px;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: var(--space-4);
		flex-shrink: 0;
		padding: var(--space-2) var(--space-4);
		flex-wrap: wrap;
	}

	.footer-text {
		font-family: var(--font-sans);
		font-size: var(--font-sm);
	}

	.footer-link {
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		color: var(--primary-text);
		text-underline-offset: 2px;
	}

	.footer-link:hover {
		text-decoration: none;
	}
</style>
