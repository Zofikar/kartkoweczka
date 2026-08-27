<script lang="ts">
	import { onDestroy } from 'svelte';
	import Modal from '@/lib/ui/Modal.svelte';
	import Button from '@/lib/ui/Button.svelte';
	import Input from '@/lib/ui/Input.svelte';
	import Heading from '@/lib/ui/Heading.svelte';
	import Text from '@/lib/ui/Text.svelte';
	import Divider from '@/lib/ui/Divider.svelte';
	import { snackError, snackSuccess } from '@/lib/stores/snackbar.svelte';
	import { ImportTestBinary, ImportTestJson } from '@/utils/transfer';
	import {
		ROOM_TTL_MS,
		TRANSFER_ACTION,
		joinTransferRoom,
		normalizeRoomCode,
	} from '@/utils/roomTransfer';
	import type { Room } from 'trystero';

	interface Props {
		open?: boolean;
		onclose?: () => void;
		onImported?: (id: string) => void;
	}

	let { open = false, onclose, onImported }: Props = $props();

	let importing = $state(false);
	let jsonInput: HTMLInputElement | undefined = $state();
	let binaryInput: HTMLInputElement | undefined = $state();

	let roomCodeInput = $state('');
	let roomStatus = $state<'idle' | 'connecting' | 'waiting' | 'timeout' | 'error'>('idle');
	let roomError = $state('');

	let room: Room | null = null;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	onDestroy(() => {
		teardownRoom();
	});

	function close() {
		teardownRoom();
		roomStatus = 'idle';
		roomCodeInput = '';
		roomError = '';
		onclose?.();
	}

	function teardownRoom() {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
		if (room) {
			Promise.resolve(room.leave()).catch(() => {});
			room = null;
		}
	}

	async function importJsonFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		await runImport(async () => ImportTestJson(new TextDecoder().decode(await file.arrayBuffer())));
	}

	async function importBinaryFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		await runImport(async () => ImportTestBinary(new Uint8Array(await file.arrayBuffer())));
	}

	async function runImport(importFn: () => Promise<string>) {
		importing = true;
		try {
			const id = await importFn();
			snackSuccess('Test zaimportowany');
			close();
			onImported?.(id);
		} catch (err) {
			snackError('Nie udało się zaimportować testu');
			console.error('Failed to import test:', err);
		} finally {
			importing = false;
		}
	}

	function connectRoom() {
		teardownRoom();
		roomError = '';
		const code = normalizeRoomCode(roomCodeInput);
		if (!code) {
			roomError = 'Podaj kod pokoju.';
			return;
		}
		roomStatus = 'connecting';
		room = joinTransferRoom(code);
		const action = room.makeAction<Uint8Array>(TRANSFER_ACTION);
		action.onMessage = (data) => {
			void handleIncoming(data);
		};
		roomStatus = 'waiting';
		timeoutId = setTimeout(() => {
			roomStatus = 'timeout';
			teardownRoom();
		}, ROOM_TTL_MS);
	}

	async function handleIncoming(data: Uint8Array) {
		teardownRoom();
		try {
			const id = await ImportTestBinary(data);
			snackSuccess('Test odebrany i zaimportowany');
			close();
			onImported?.(id);
		} catch (err) {
			snackError('Nie udało się zaimportować odebranego testu');
			console.error('Failed to import received test:', err);
			roomStatus = 'error';
		}
	}
</script>

<Modal {open} onclose={close} title="Importuj test">
	<div class="modal-content">
		<input
			type="file"
			accept=".json,application/json"
			class="file-input-hidden"
			bind:this={jsonInput}
			onchange={importJsonFile}
		/>
		<input
			type="file"
			accept=".kart,application/octet-stream"
			class="file-input-hidden"
			bind:this={binaryInput}
			onchange={importBinaryFile}
		/>

		<Text variant="muted" as="span">
			Uwaga: import nadpisze ten test, jeśli już u Ciebie istnieje — wraz z pytaniami.
		</Text>

		<Heading level={5}>Plik</Heading>
		<div class="method-list">
			<Button variant="outline" onclick={() => jsonInput?.click()} disabled={importing}>
				{importing ? 'Importowanie...' : 'Wczytaj plik JSON'}
			</Button>
			<Button variant="outline" onclick={() => binaryInput?.click()} disabled={importing}>
				Wczytaj plik binarny
			</Button>
		</div>

		<Divider />

		<Heading level={5}>Odebranie bezpośrednie (P2P)</Heading>
		<Text variant="muted">
			Wprowadź kod pokoju wygenerowany na urządzeniu, z którego eksportujesz test.
		</Text>

		<div class="room-connect">
			<div class="room-connect-input">
				<Input
					label="Kod pokoju"
					placeholder="np. ABC123"
					bind:value={roomCodeInput}
					disabled={roomStatus === 'waiting' || roomStatus === 'connecting'}
				/>
			</div>
			<Button
				variant="primary"
				onclick={connectRoom}
				disabled={roomStatus === 'waiting' || roomStatus === 'connecting'}
			>
				Połącz
			</Button>
		</div>

		{#if roomStatus === 'connecting'}
			<Text variant="muted">Łączenie...</Text>
		{:else if roomStatus === 'waiting'}
			<Text variant="muted">Połączono. Oczekiwanie na dane testu...</Text>
		{:else if roomStatus === 'timeout'}
			<Text variant="error">Przekroczono czas oczekiwania. Spróbuj ponownie.</Text>
		{:else if roomStatus === 'error'}
			<Text variant="error">{roomError}</Text>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={close}>Zamknij</Button>
	{/snippet}
</Modal>

<style>
	.modal-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.method-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.room-connect {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
	}

	.room-connect-input {
		flex: 1;
		min-width: 0;
	}

	.file-input-hidden {
		display: none;
	}
</style>
