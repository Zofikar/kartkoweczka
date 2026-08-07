import { db } from '@/db/dbStore';
import { loadAllTags } from '@/pages/questions/service';
import type { Database } from '@/db/db';

let allTags = $state<string[]>([]);
let loaded = $state(false);

export function getTags(): string[] {
	return allTags;
}

export function isTagsLoaded(): boolean {
	return loaded;
}

export function initTags(): () => void {
	if (loaded) return () => {};

	const unsubscribe = db.subscribe(async (d: Database | null) => {
		if (d && !loaded) {
			allTags = await loadAllTags(d);
			loaded = true;
		}
	});

	return unsubscribe;
}

export async function refreshTags(database: Database): Promise<void> {
	allTags = await loadAllTags(database);
}
