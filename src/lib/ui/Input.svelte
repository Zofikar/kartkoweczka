<script lang="ts">
	interface Props {
		type?: 'text' | 'number' | 'email' | 'password';
		value?: string;
		oninput?: (e: InputEvent) => void;
		label?: string;
		placeholder?: string;
		disabled?: boolean;
		error?: string;
		[k: string]: unknown;
	}

	let {
		type = 'text',
		value = '',
		oninput,
		label,
		placeholder,
		disabled = false,
		error,
		...restProps
	}: Props = $props();
</script>

<div class="input-group" class:input-group--error={!!error}>
	{#if label}
		<label class="input-label">{label}</label>
	{/if}
	<input
		class="input"
		{type}
		{value}
		{placeholder}
		{disabled}
		{oninput}
		aria-invalid={!!error}
		{...restProps}
	/>
	{#if error}
		<span class="input-error">{error}</span>
	{/if}
</div>

<style>
	.input-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.input-label {
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		font-weight: var(--font-medium);
		color: var(--text);
	}

	.input {
		font-family: var(--font-sans);
		font-size: var(--font-base);
		padding: var(--space-2) var(--space-3);
		background-color: var(--background);
		color: var(--text);
		border: 2px solid var(--background-muted);
		border-radius: var(--radius-md);
		transition: border-color 150ms ease;
		outline: none;
		line-height: 1.5;
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

	.input-group--error .input {
		border-color: var(--accent);
	}

	.input-error {
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		color: var(--accent);
	}
</style>
