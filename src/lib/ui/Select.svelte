<script lang="ts">
	import Field from './Field.svelte';

	let selectId = $state(crypto.randomUUID());

	interface Props<T extends string> {
		value?: T | null;
		size?: 'sm' | 'md' | 'lg';
		onchange?: (e: Event) => void;
		label?: string;
		disabled?: boolean;
		id?: string;
		options: { value: T | null; label: string }[];
		[k: string]: unknown;
	}

	let {
		value = $bindable(null),
		size = 'md',
		onchange,
		label,
		disabled = false,
		id,
		options,
		...restProps
	}: Props<string> = $props();

	function handleChange(e: Event) {
		const raw = (e.target as HTMLSelectElement).value;
		const match = options.find((o) => (o.value === null ? '' : o.value) === raw);
		value = (match?.value ?? null) as string | null;
		onchange?.(e);
	}
</script>

<Field {label} forId={id || selectId}>
	<select
		class="select select--{size}"
		id={id || selectId}
		value={value === null ? '' : (value ?? '')}
		onchange={handleChange}
		{disabled}
		{...restProps}
	>
		{#each options as option (option.label)}
			<option value={option.value === null ? '' : (option.value ?? '')}>{option.label}</option>
		{/each}
	</select>
</Field>

<style>
	.select {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		font-family: var(--font-sans);
		font-weight: var(--font-medium);
		background-color: var(--background);
		color: var(--text);
		border: var(--control-border-w) solid var(--background-muted);
		border-radius: var(--control-radius);
		cursor: pointer;
		outline: none;
		line-height: 1;
		transition: border-color 150ms ease;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23808080' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right var(--control-px-sm) center;
	}

	.select--sm {
		height: var(--control-h-sm);
		padding: 0 calc(var(--control-px-sm) + 16px) 0 var(--control-px-sm);
		font-size: var(--control-font-sm);
	}

	.select--md {
		height: var(--control-h-md);
		padding: 0 calc(var(--control-px-md) + 16px) 0 var(--control-px-md);
		font-size: var(--control-font-md);
	}

	.select--lg {
		height: var(--control-h-lg);
		padding: 0 calc(var(--control-px-lg) + 16px) 0 var(--control-px-lg);
		font-size: var(--control-font-lg);
	}

	.select:focus-visible {
		border-color: var(--primary);
	}

	.select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
