<script lang="ts">
	import Button from '@/lib/ui/Button.svelte';
	import Select from '@/lib/ui/Select.svelte';
	import TagSelect from './TagSelect.svelte';
	import type { QuestionType } from '@/db/repositories';
	import { i18n } from '@/lib/i18n.svelte';

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
		label={i18n.t('questions.filters.type')}
		size="md"
		bind:value={filterType}
		onchange={() => onchange?.()}
		options={[
			{ value: null, label: i18n.t('questions.filters.all') },
			{ value: 'choice', label: i18n.t('questionType.choice') },
			{ value: 'true_false', label: i18n.t('questionType.trueFalse') },
		]}
	/>

	<div class="filter-group--tags">
		<TagSelect
			label={i18n.t('questions.filters.tags')}
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
		label={i18n.t('questions.filters.tagMode')}
		size="md"
		bind:value={filterTagMode}
		onchange={() => onchange?.()}
		disabled={filterTags.length === 0}
		options={[
			{ value: 'any', label: i18n.t('questions.filters.any') },
			{ value: 'all', label: i18n.t('questions.filters.allTags') },
		]}
	/>

	{#if hasActiveFilters}
		<Button variant="ghost" size="md" onclick={clearFilters}
			>{i18n.t('questions.filters.clear')}</Button
		>
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
