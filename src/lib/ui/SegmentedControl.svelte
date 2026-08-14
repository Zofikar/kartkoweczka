<script lang="ts" generics="T extends string">
	import Button from './Button.svelte';

	interface Props {
		options: { value: T; label: string }[];
		value: T;
		onchange?: (value: T) => void;
		size?: 'sm' | 'md' | 'lg';
		role?: 'radiogroup' | 'tablist';
		'aria-label'?: string;
		'aria-labelledby'?: string;
	}

	let {
		options,
		value,
		onchange,
		size = 'sm',
		role = 'radiogroup',
		...restProps
	}: Props = $props();
</script>

<div class="segmented-control" {role} {...restProps}>
	{#each options as option (option.value)}
		<Button
			variant={value === option.value ? 'primary' : 'ghost'}
			{size}
			role={role === 'radiogroup' ? 'radio' : 'tab'}
			aria-checked={role === 'radiogroup' ? value === option.value : undefined}
			aria-selected={role === 'tablist' ? value === option.value : undefined}
			onclick={() => onchange?.(option.value)}
		>
			{option.label}
		</Button>
	{/each}
</div>

<style>
	.segmented-control {
		display: inline-flex;
		gap: var(--space-1);
		/* Hug the options — never stretch to fill a flex/grid parent. */
		width: fit-content;
		/* Fill matches inputs/selects so the control stays visible on muted card backgrounds. */
		background-color: var(--background);
		border: var(--control-border-w) solid var(--background-muted);
		border-radius: var(--control-radius);
		padding: 2px;
	}
</style>
