/**
 * Change notifications for the data layer.
 *
 * Repositories emit a topic after a mutation commits, so interested parties
 * (e.g. the tags store) can refresh themselves without the caller of the
 * mutation having to know what else was affected.
 */

export type DataTopic = 'questions' | 'tests' | 'revisions' | 'tags';

type Listener = () => void;

const listeners = new Map<DataTopic, Set<Listener>>();
const sourceId = crypto.randomUUID();
const channel =
	typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('database-changes');

channel?.addEventListener('message', ({ data }: MessageEvent<ChangeNotification>) => {
	if (data.sourceId !== sourceId) notifyListeners(data.topics);
});

interface ChangeNotification {
	sourceId: string;
	topics: DataTopic[];
}

/** Subscribes to a data topic. Returns an unsubscribe function. */
export function onDataChanged(topic: DataTopic, listener: Listener): () => void {
	let set = listeners.get(topic);
	if (!set) {
		set = new Set();
		listeners.set(topic, set);
	}
	set.add(listener);
	return () => {
		set.delete(listener);
	};
}

/**
 * Internal to repositories: announces that the given topics changed.
 * A throwing listener is isolated — it can neither break other listeners
 * nor make a committed mutation look failed to the caller.
 */
export function emitDataChanged(...topics: DataTopic[]): void {
	notifyListeners(topics);
	channel?.postMessage({ sourceId, topics } satisfies ChangeNotification);
}

function notifyListeners(topics: DataTopic[]): void {
	for (const topic of topics) {
		for (const listener of (listeners.get(topic) ?? []).values()) {
			try {
				listener();
			} catch (error) {
				console.error(`Listener for "${topic}" failed:`, error);
			}
		}
	}
}
