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
	import { i18n } from '@/lib/i18n.svelte';

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
			snackSuccess(i18n.t('transfer.import.success'));
			close();
			onImported?.(id);
		} catch (err) {
			snackError(i18n.t('transfer.import.error'));
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
			roomError = i18n.t('transfer.import.roomRequired');
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
			snackSuccess(i18n.t('transfer.import.receivedSuccess'));
			close();
			onImported?.(id);
		} catch (err) {
			snackError(i18n.t('transfer.import.receivedError'));
			console.error('Failed to import received test:', err);
			roomStatus = 'error';
		}
	}
</script>

<Modal {open} onclose={close} title={i18n.t('transfer.import.title')}>
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
			{i18n.t('transfer.import.warning')}
		</Text>

		<Heading level={5}>{i18n.t('transfer.file')}</Heading>
		<div class="method-list">
			<Button variant="outline" onclick={() => jsonInput?.click()} disabled={importing}>
				{importing ? i18n.t('transfer.import.importing') : i18n.t('transfer.import.json')}
			</Button>
			<Button variant="outline" onclick={() => binaryInput?.click()} disabled={importing}>
				{i18n.t('transfer.import.binary')}
			</Button>
		</div>

		<Divider />

		<Heading level={5}>{i18n.t('transfer.import.p2pTitle')}</Heading>
		<Text variant="muted">
			{i18n.t('transfer.import.p2pDescription')}
		</Text>

		<div class="room-connect">
			<div class="room-connect-input">
				<Input
					label={i18n.t('transfer.roomCode')}
					placeholder={i18n.t('transfer.import.roomPlaceholder')}
					bind:value={roomCodeInput}
					disabled={roomStatus === 'waiting' || roomStatus === 'connecting'}
				/>
			</div>
			<Button
				variant="primary"
				onclick={connectRoom}
				disabled={roomStatus === 'waiting' || roomStatus === 'connecting'}
			>
				{i18n.t('transfer.import.connect')}
			</Button>
		</div>

		{#if roomStatus === 'connecting'}
			<Text variant="muted">{i18n.t('transfer.import.connecting')}</Text>
		{:else if roomStatus === 'waiting'}
			<Text variant="muted">{i18n.t('transfer.import.waiting')}</Text>
		{:else if roomStatus === 'timeout'}
			<Text variant="error">{i18n.t('transfer.import.timeout')}</Text>
		{:else if roomStatus === 'error'}
			<Text variant="error">{roomError}</Text>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={close}>{i18n.t('common.close')}</Button>
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
