import { listTags, onDataChanged } from '@/db/repositories';

let allTags = $state<string[]>([]);
let initialized = false;

export function getTags(): string[] {
	return allTags;
}

/**
 * Loads tags and keeps them in sync for the app's lifetime — the data layer
 * notifies this store whenever a mutation affects tags, so callers never need
 * to refresh themselves.
 *
 * This store is an app-lifetime singleton: the change listener is registered
 * once and never removed. Every call triggers a refresh, so mounting a page
 * re-syncs tags and retries after a previous load failure.
 */
export function initTags(): void {
	if (!initialized) {
		initialized = true;
		onDataChanged('tags', () => void refresh());
	}
	void refresh();
}

async function refresh(): Promise<void> {
	try {
		allTags = await listTags();
	} catch (error) {
		console.error('Failed to load tags:', error);
	}
}
