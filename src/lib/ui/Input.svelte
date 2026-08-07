<script lang="ts">
	import Field from './Field.svelte';

	let inputId = $state(crypto.randomUUID());

	interface Props {
		type?: 'text' | 'number' | 'email' | 'password';
		value?: string;
		size?: 'sm' | 'md' | 'lg';
		oninput?: (e: Event) => void;
		onchange?: (e: Event) => void;
		label?: string;
		placeholder?: string;
		disabled?: boolean;
		error?: string;
		id?: string;
		class?: never;
		className?: string;
		[k: string]: unknown;
	}

	let {
		type = 'text',
		value = $bindable(''),
		size = 'md',
		oninput,
		onchange,
		label,
		placeholder,
		disabled = false,
		error,
		id,

		...restProps
	}: Props = $props();
</script>

<Field {label} {error} forId={id || inputId}>
	<input
		class="input input--{size}"
		class:input--error={!!error}
		id={id || inputId}
		{type}
		bind:value
		{placeholder}
		{disabled}
		{oninput}
		{onchange}
		aria-invalid={!!error}
		{...restProps}
	/>
</Field>

<style>
	.input {
		box-sizing: border-box;
		width: 100%;
		font-family: var(--font-sans);
		background-color: var(--background);
		color: var(--text);
		border: var(--control-border-w) solid var(--background-muted);
		border-radius: var(--control-radius);
		transition: border-color 150ms ease;
		outline: none;
		line-height: 1;
	}

	.input--sm {
		height: var(--control-h-sm);
		padding: 0 var(--control-px-sm);
		font-size: var(--control-font-sm);
	}

	.input--md {
		height: var(--control-h-md);
		padding: 0 var(--control-px-md);
		font-size: var(--control-font-md);
	}

	.input--lg {
		height: var(--control-h-lg);
		padding: 0 var(--control-px-lg);
		font-size: var(--control-font-lg);
	}

	.input::placeholder {
		color: var(--text-muted);
	}

	.input:focus-visible {
		border-color: var(--primary);
	}

	.input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.input--error {
		border-color: var(--accent);
	}
</style>
