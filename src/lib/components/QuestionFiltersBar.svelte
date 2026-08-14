<script lang="ts">
	import Button from '@/lib/ui/Button.svelte';
	import Select from '@/lib/ui/Select.svelte';
	import TagSelect from './TagSelect.svelte';
	import type { QuestionType } from '@/db/schema/types';

	interface Props {
		filterType?: QuestionType | null;
		filterTags?: string[];
		filterTagMode?: 'any' | 'all';
		allTags?: readonly string[];
		/** Called after any filter changes (including clear). */
		onchange?: () => void;
	}

	let {
		filterType = $bindable(null),
		filterTags = $bindable([]),
		filterTagMode = $bindable('any'),
		allTags = [],
		onchange,
	}: Props = $props();

	let hasActiveFilters = $derived(filterType !== null || filterTags.length > 0);

	function clearFilters() {
		filterType = null;
		filterTags = [];
		filterTagMode = 'any';
		onchange?.();
	}
</script>

<div class="filters-bar">
	<Select
		label="Typ pytania"
		size="md"
		bind:value={filterType}
		onchange={() => onchange?.()}
		options={[
			{ value: null, label: 'Wszystkie' },
			{ value: 'choice', label: 'Jednokrotny wybór' },
			{ value: 'true_false', label: 'Prawda / Fałsz' },
		]}
	/>

	<div class="filter-group--tags">
		<TagSelect
			label="Tagi"
			size="md"
			selected={filterTags}
			{allTags}
			onselect={(tags) => {
				filterTags = tags;
				onchange?.();
			}}
		/>
	</div>

	<Select
		label="Tryb tagów"
		size="md"
		bind:value={filterTagMode}
		onchange={() => onchange?.()}
		disabled={filterTags.length === 0}
		options={[
			{ value: 'any', label: 'Dowolny (ANY)' },
			{ value: 'all', label: 'Wszystkie (ALL)' },
		]}
	/>

	{#if hasActiveFilters}
		<Button variant="ghost" size="md" onclick={clearFilters}>Wyczyść filtry</Button>
	{/if}
</div>

<style>
	.filters-bar {
		display: flex;
		align-items: flex-end;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.filter-group--tags {
		flex: 1;
		min-width: 200px;
		max-width: 400px;
	}
</style>
