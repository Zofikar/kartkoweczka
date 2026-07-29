<script lang="ts">
	import { Link, useLocation } from 'svelte-navigator';
	import List from '../ui/List/List.svelte';
	import ListItem from '../ui/List/ListItem.svelte';
	import { onMount } from 'svelte';

	interface PageEntry {
		id: string;
		label: string;
		path: string;
	}

	interface Props {
		pages?: PageEntry[];
		mobileOpen?: boolean;
		onclose?: () => void;
		[k: string]: unknown;
	}

	let { pages = [], mobileOpen = false, onclose, ...restProps }: Props = $props();

	const location = useLocation();

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
</script>

{#if isMobile}
	{#if mobileOpen}
		<div class="sidebar-overlay" onclick={handleNav} role="presentation">
			<aside
				class="sidebar sidebar-drawer sidebar-drawer-open"
				onclick={(e: Event) => e.stopPropagation()}
				{...restProps}
			>
				<nav aria-label="Nawigacja główna">
					<List>
						{#each pages as page}
							<Link to={page.path} class="sidebar-link" onclick={handleNav}>
								<ListItem active={$location.pathname === page.path}>
									{page.label}
								</ListItem>
							</Link>
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
				{#each pages as page}
					<Link to={page.path} class="sidebar-link">
						<ListItem active={$location.pathname === page.path}>
							{page.label}
						</ListItem>
					</Link>
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
