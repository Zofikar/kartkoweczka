<script lang="ts">
	import Badge from '@/lib/ui/Badge.svelte';
	import Field from '@/lib/ui/Field.svelte';

	interface Props {
		selected: string[];
		allTags: string[];
		size?: 'sm' | 'md' | 'lg';
		label?: string;
		onselect?: (tags: string[]) => void;
	}

	let { selected = [], allTags = [], size = 'md', label, onselect }: Props = $props();

	let inputValue = $state('');
	let showDropdown = $state(false);
	let inputEl = $state<HTMLInputElement | undefined>();

	let chipSize: 'sm' | 'md' = $derived(size === 'lg' ? 'md' : 'sm');

	let filteredTags = $derived(
		inputValue.trim()
			? allTags.filter(
					(t) => t.toLowerCase().includes(inputValue.toLowerCase()) && !selected.includes(t)
				)
			: allTags.filter((t) => !selected.includes(t))
	);

	let newTagMatch = $derived(
		inputValue.trim() &&
			!allTags.some((t) => t.toLowerCase() === inputValue.trim().toLowerCase()) &&
			!selected.some((t) => t.toLowerCase() === inputValue.trim().toLowerCase())
			? inputValue.trim()
			: null
	);

	function addTag(tag: string) {
		if (!selected.includes(tag)) {
			onselect?.([...selected, tag]);
		}
		inputValue = '';
		inputEl?.focus();
	}

	function removeTag(tag: string) {
		onselect?.(selected.filter((t) => t !== tag));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && inputValue.trim()) {
			e.preventDefault();
			const match = filteredTags[0] ?? newTagMatch;
			if (match) addTag(match);
		} else if (e.key === 'Backspace' && !inputValue && selected.length > 0) {
			removeTag(selected[selected.length - 1]);
		} else if (e.key === 'Escape') {
			showDropdown = false;
		}
	}

	function handleFocus() {
		showDropdown = true;
	}

	function handleBlur() {
		// Delay to allow click on dropdown items
		setTimeout(() => {
			showDropdown = false;
		}, 150);
	}
</script>

<Field {label}>
	<div class="tag-select">
		<div class="tag-input-wrapper tag-input-wrapper--{size}">
			<div class="tag-chips">
				{#each selected as tag (tag)}
					<Badge variant="secondary" size={chipSize}>
						{tag}
						<button
							type="button"
							class="tag-chip-remove"
							aria-label="Usuń tag {tag}"
							onclick={() => removeTag(tag)}
						>
							✕
						</button>
					</Badge>
				{/each}
				<input
					bind:this={inputEl}
					bind:value={inputValue}
					type="text"
					class="tag-input"
					placeholder={selected.length === 0 ? 'Dodaj tagi...' : ''}
					onkeydown={handleKeydown}
					onfocus={handleFocus}
					onblur={handleBlur}
					aria-label="Wyszukaj lub dodaj tag"
				/>
			</div>
		</div>

		{#if showDropdown && (filteredTags.length > 0 || newTagMatch)}
			<div class="tag-dropdown">
				{#if newTagMatch}
					<button
						type="button"
						class="tag-dropdown-item tag-dropdown-item--new"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => addTag(newTagMatch)}
					>
						Utwórz tag "<strong>{newTagMatch}</strong>"
					</button>
				{/if}
				{#each filteredTags as tag (tag)}
					<button
						type="button"
						class="tag-dropdown-item"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => addTag(tag)}
					>
						{tag}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</Field>

<style>
	.tag-select {
		position: relative;
	}

	.tag-input-wrapper {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		border: var(--control-border-w) solid var(--background-muted);
		border-radius: var(--control-radius);
		background: var(--background);
		font-family: var(--font-sans);
		font-weight: var(--font-medium);
		line-height: 1;
		transition: border-color 150ms ease;
	}

	.tag-input-wrapper--sm {
		min-height: var(--control-h-sm);
		padding: 2px var(--control-px-sm);
		font-size: var(--control-font-sm);
	}

	.tag-input-wrapper--md {
		min-height: var(--control-h-md);
		padding: 2px var(--control-px-md);
		font-size: var(--control-font-md);
	}

	.tag-input-wrapper--lg {
		min-height: var(--control-h-lg);
		padding: 2px var(--control-px-lg);
		font-size: var(--control-font-lg);
	}

	.tag-input-wrapper:focus-within {
		border-color: var(--primary);
	}

	.tag-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		align-items: center;
		flex: 1;
		min-width: 0;
	}

	.tag-chip-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border: none;
		background: transparent;
		color: var(--secondary-text);
		cursor: pointer;
		font-size: 10px;
		padding: 0;
		border-radius: var(--radius-full);
		opacity: 0.7;
		transition: opacity 100ms ease;
	}

	.tag-chip-remove:hover {
		opacity: 1;
	}

	.tag-input {
		flex: 1;
		min-width: 100px;
		border: none;
		outline: none;
		background: transparent;
		font-family: inherit;
		font-size: inherit;
		font-weight: inherit;
		color: var(--text);
		padding: 0;
		line-height: inherit;
	}

	.tag-input::placeholder {
		color: var(--text-muted);
	}

	.tag-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: var(--space-1);
		background: var(--background);
		border: 1px solid var(--background-muted);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		max-height: 200px;
		overflow-y: auto;
		z-index: 50;
	}

	.tag-dropdown-item {
		display: block;
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border: none;
		background: transparent;
		font-family: var(--font-sans);
		font-size: var(--font-sm);
		color: var(--text);
		text-align: left;
		cursor: pointer;
		transition: background-color 100ms ease;
	}

	.tag-dropdown-item:hover {
		background: var(--background-muted);
	}

	.tag-dropdown-item--new {
		color: var(--primary);
		border-bottom: 1px solid var(--background-muted);
	}
</style>
