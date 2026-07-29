<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		onclick?: (e: MouseEvent) => void;
		active?: boolean;
		[k: string]: unknown;
	}

	let { children, onclick, active = false, ...restProps }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (!onclick) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick(e as unknown as MouseEvent);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<li
	class="list-item"
	class:list-item--interactive={!!onclick}
	class:list-item--active={active}
	role={onclick ? 'button' : undefined}
	tabindex={onclick ? 0 : undefined}
	{onclick}
	onkeydown={handleKeydown}
	{...restProps}
>
	{@render children?.()}
</li>

<style>
	.list-item {
		padding: var(--space-2) var(--space-3);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--font-base);
		border-radius: var(--radius-sm);
		transition: background-color 150ms ease;
	}

	.list-item--interactive {
		cursor: pointer;
	}

	.list-item--interactive:hover {
		background-color: var(--background-muted);
	}

	.list-item--interactive:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.list-item--active {
		background-color: var(--primary);
		color: var(--primary-text);
	}

	.list-item--active:hover {
		background-color: var(--primary-muted);
	}
</style>
