<script lang="ts">
	import { isTauri } from '@tauri-apps/api/core';

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

	async function handleClick(e: MouseEvent) {
		if (isTauri()) {
			e.preventDefault();
			const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

			new WebviewWindow('licenses', {
				url: `${import.meta.env.BASE_URL}/licenses.html`,
				title: 'Licencje',
				width: 800,
				height: 600,
			});
		}
	}
</script>

<footer class="primary footer-bar" {...restProps}>
	<span class="footer-text">
		Copyright &copy; {copyrightYear}
		{copyrightHolder}
	</span>
	<a
		href="{import.meta.env.BASE_URL}/licenses.html"
		class="footer-link"
		target="_blank"
		onclick={handleClick}
		rel="noopener">Licencje</a
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
