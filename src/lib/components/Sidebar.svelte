<script lang="ts">
	import List from '../ui/List/List.svelte';
	import ListItem from '../ui/List/ListItem.svelte';
	import { onMount } from 'svelte';
	import { isActive, p, type Route, staticRoutes, staticRoutesChildren } from '@/router';

	interface Props {
		mobileOpen?: boolean;
		onclose?: () => void;
		class?: never;
		[k: string]: unknown;
	}

	let { mobileOpen = false, onclose, ...restProps }: Props = $props();

	const pages = staticRoutes.filter((r) => !r.debug || import.meta.env.DEV);

	let isMobile = $state(false);

	function handleResize() {
		isMobile = window.matchMedia('(max-width: 767px)').matches;
	}

	onMount(() => {
		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	function handleNav() {
		onclose?.();
	}

	function pageIsActive(path: Route): boolean {
		if (isActive(path)) {
			return true;
		}

		const matchingStatics = pages
			.filter((page) => isActive.startsWith(page.path))
			.toSorted((a, b) => b.path.length - a.path.length);
		if (matchingStatics.some((rs) => isActive(rs.path))) return false;

		return staticRoutesChildren[path]?.some((c) => isActive(c)) ?? false;
	}

	function handleDrawerKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && mobileOpen) onclose?.();
	}
</script>

<svelte:window onkeydown={handleDrawerKeydown} />

{#if isMobile}
	{#if mobileOpen}
		<div class="sidebar-overlay" onclick={handleNav} role="presentation">
			<aside
				class="sidebar sidebar-drawer sidebar-drawer-open"
				onclick={(e) => e.stopPropagation()}
				{...restProps}
			>
				<nav aria-label="Nawigacja główna">
					<List>
						{#each pages as page (page.id)}
							<ListItem active={pageIsActive(page.path)}>
								<a href={p(page.path)} class="sidebar-link" onclick={handleNav}>
									{page.label}
								</a>
							</ListItem>
						{/each}
					</List>
				</nav>
			</aside>
		</div>
	{/if}
{:else}
	<aside class="sidebar" {...restProps}>
		<nav aria-label="Nawigacja główna">
			<List>
				{#each pages as page (page.id)}
					<ListItem active={pageIsActive(page.path)}>
						<a href={p(page.path)} class="sidebar-link">
							{page.label}
						</a>
					</ListItem>
				{/each}
			</List>
		</nav>
	</aside>
{/if}

<style>
	.sidebar {
		width: 200px;
		background-color: var(--background-muted);
		overflow: auto;
		padding: var(--space-4) var(--space-2);

		&::-webkit-scrollbar {
			display: none;
		}
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	.sidebar-link {
		text-decoration: none;
		color: inherit;
		display: block;
	}

	.sidebar-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.5);
	}

	.sidebar-drawer {
		height: 100%;
		position: fixed;
		top: 0;
		left: 0;
		z-index: 1001;
		transform: translateX(-100%);
		transition: transform 0.25s ease;
	}

	.sidebar-drawer-open {
		transform: translateX(0);
	}
</style>
