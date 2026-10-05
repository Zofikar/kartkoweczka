import * as Comlink from 'comlink';

import {
	databaseClientLockName,
	type DatabaseBridge,
	type DatabaseBridgeResult,
	type DatabaseMethod,
	type DatabaseValue,
} from './bridge';
import type { DatabaseWorkerHostApi } from './db.worker.service';

const DATABASE_OWNER_LOCK = 'kartkoweczka-database-owner-v2';
const DATABASE_RPC_CHANNEL = 'kartkoweczka-database-rpc-v2';
const DATABASE_REQUEST_TIMEOUT_MS = 15_000;
const DATABASE_READY_RETRY_MS = 100;

interface DatabaseRequest {
	type: 'request';
	requestId: string;
	clientId: string;
	operation: 'ready' | 'execute';
	sql?: string;
	params?: DatabaseValue[];
	method?: DatabaseMethod;
}

interface DatabaseResponse {
	type: 'response';
	requestId: string;
	clientId: string;
	result?: DatabaseBridgeResult;
	error?: string;
}

type DatabaseMessage = DatabaseRequest | DatabaseResponse;

interface PendingRequest {
	resolve: (result: DatabaseBridgeResult) => void;
	reject: (error: Error) => void;
	timeoutId: ReturnType<typeof setTimeout>;
}

export async function createBrowserDatabaseBridge(): Promise<DatabaseBridge> {
	await ensurePersistentStorage();

	if (!navigator.locks || typeof BroadcastChannel === 'undefined') {
		throw new Error('This browser does not support safe multi-tab database access.');
	}

	const coordinator = new DatabaseCoordinator();
	coordinator.start();
	await coordinator.ready();
	return coordinator;
}

class DatabaseCoordinator implements DatabaseBridge {
	private readonly clientId = crypto.randomUUID();
	private readonly clientChannel = new BroadcastChannel(DATABASE_RPC_CHANNEL);
	private readonly pendingRequests = new Map<string, PendingRequest>();

	start(): void {
		this.clientChannel.addEventListener('message', this.handleClientMessage);
		// Held until the tab goes away; lets the host roll back a transaction this tab abandoned.
		void navigator.locks.request(
			databaseClientLockName(this.clientId),
			() => new Promise(() => {})
		);
		void this.waitForDatabaseOwnership().catch((error) => {
			console.error('Database ownership coordinator failed:', error);
		});
	}

	async ready(): Promise<void> {
		const deadline = Date.now() + DATABASE_REQUEST_TIMEOUT_MS;

		while (true) {
			try {
				await this.sendRequest({ operation: 'ready' }, DATABASE_READY_RETRY_MS);
				return;
			} catch (error) {
				if (Date.now() >= deadline) throw error;
			}
		}
	}

	execute(
		sql: string,
		params: DatabaseValue[],
		method: DatabaseMethod
	): Promise<DatabaseBridgeResult> {
		return this.sendRequest({ operation: 'execute', sql, params, method });
	}

	private readonly handleClientMessage = ({ data }: MessageEvent<DatabaseMessage>): void => {
		if (data.type !== 'response' || data.clientId !== this.clientId) return;

		const pending = this.pendingRequests.get(data.requestId);
		if (!pending) return;

		clearTimeout(pending.timeoutId);
		this.pendingRequests.delete(data.requestId);

		if (data.error) pending.reject(new Error(data.error));
		else pending.resolve(data.result ?? { rows: [] });
	};

	private sendRequest(
		request: Pick<DatabaseRequest, 'operation' | 'sql' | 'params' | 'method'>,
		timeoutMs = DATABASE_REQUEST_TIMEOUT_MS
	): Promise<DatabaseBridgeResult> {
		const requestId = crypto.randomUUID();

		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				this.pendingRequests.delete(requestId);
				reject(new Error('Database owner did not respond in time.'));
			}, timeoutMs);

			this.pendingRequests.set(requestId, { resolve, reject, timeoutId });
			this.clientChannel.postMessage({
				type: 'request',
				requestId,
				clientId: this.clientId,
				...request,
			} satisfies DatabaseRequest);
		});
	}

	private async waitForDatabaseOwnership(): Promise<void> {
		await navigator.locks.request(DATABASE_OWNER_LOCK, async () => {
			await this.serveDatabaseRequests();
		});
	}

	private async serveDatabaseRequests(): Promise<never> {
		const worker = new Worker(new URL('./db.worker.ts', import.meta.url), { type: 'module' });
		const databaseHost = Comlink.wrap<DatabaseWorkerHostApi>(worker);
		const hostChannel = new BroadcastChannel(DATABASE_RPC_CHANNEL);

		hostChannel.addEventListener('message', ({ data }: MessageEvent<DatabaseMessage>) => {
			if (data.type === 'request') {
				void this.handleDatabaseRequest(databaseHost, hostChannel, data);
			}
		});

		return new Promise<never>(() => undefined);
	}

	private async handleDatabaseRequest(
		databaseHost: Comlink.Remote<DatabaseWorkerHostApi>,
		hostChannel: BroadcastChannel,
		request: DatabaseRequest
	): Promise<void> {
		try {
			const result = await executeDatabaseRequest(databaseHost, request);
			hostChannel.postMessage(createResponse(request, result));
		} catch (error) {
			hostChannel.postMessage(createErrorResponse(request, error));
		}
	}
}

async function executeDatabaseRequest(
	databaseHost: Comlink.Remote<DatabaseWorkerHostApi>,
	request: DatabaseRequest
): Promise<DatabaseBridgeResult> {
	if (request.operation === 'ready') {
		await databaseHost.ready();
		return { rows: [] };
	}

	if (!request.sql || !request.params || !request.method) {
		throw new Error('Invalid database execution request.');
	}

	return databaseHost.executeForClient(
		request.clientId,
		request.sql,
		request.params,
		request.method
	);
}

function createResponse(request: DatabaseRequest, result: DatabaseBridgeResult): DatabaseResponse {
	return {
		type: 'response',
		requestId: request.requestId,
		clientId: request.clientId,
		result,
	};
}

function createErrorResponse(request: DatabaseRequest, error: unknown): DatabaseResponse {
	return {
		type: 'response',
		requestId: request.requestId,
		clientId: request.clientId,
		error: error instanceof Error ? error.message : String(error),
	};
}

async function ensurePersistentStorage(): Promise<void> {
	if (!navigator.storage?.persist) {
		console.warn('Storage API is unavailable; database persistence cannot be guaranteed.');
		return;
	}

	if (await navigator.storage.persisted()) return;

	if (!(await navigator.storage.persist())) {
		console.warn('Persistent storage was denied; the browser may evict application data.');
	}
}
