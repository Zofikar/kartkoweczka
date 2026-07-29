<script lang="ts">
	import IconButton from '../ui/IconButton.svelte';

	interface Props {
		brandName?: string;
		isLight: boolean;
		ontoggletheme?: () => void;
		onmenutoggle?: () => void;
		[k: string]: unknown;
	}

	let {
		brandName = 'Kartkówka',
		isLight,
		ontoggletheme,
		onmenutoggle,
		...restProps
	}: Props = $props();
</script>

<nav class="primary nav-bar" {...restProps}>
	<span class="menu-toggle-wrapper">
		<IconButton variant="primary" size="md" ariaLabel="Otwórz menu" onclick={onmenutoggle}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<line x1="3" y1="6" x2="21" y2="6"></line>
				<line x1="3" y1="12" x2="21" y2="12"></line>
				<line x1="3" y1="18" x2="21" y2="18"></line>
			</svg>
		</IconButton>
	</span>
	<span class="nav-brand">{brandName}</span>
	<span class="nav-spacer"></span>
	<IconButton
		variant="primary"
		size="md"
		ariaLabel={isLight ? 'Przełącz na tryb ciemny' : 'Przełącz na tryb jasny'}
		onclick={ontoggletheme}
	>
		{#if isLight}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
			</svg>
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="12" cy="12" r="5"></circle>
				<line x1="12" y1="1" x2="12" y2="3"></line>
				<line x1="12" y1="21" x2="12" y2="23"></line>
				<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
				<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
				<line x1="1" y1="12" x2="3" y2="12"></line>
				<line x1="21" y1="12" x2="23" y2="12"></line>
				<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
				<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
			</svg>
		{/if}
	</IconButton>
</nav>

<style>
	.nav-bar {
		display: flex;
		align-items: center;
		padding: 0 var(--space-4);
		height: 64px;
		flex-shrink: 0;
		gap: var(--space-2);
	}

	.nav-brand {
		font-family: var(--font-sans);
		font-size: var(--font-xl);
		font-weight: var(--font-bold);
	}

	.nav-spacer {
		flex: 1;
	}

	.menu-toggle-wrapper {
		display: none;
	}

	@media (max-width: 767px) {
		.menu-toggle-wrapper {
			display: contents;
		}
	}
</style>
